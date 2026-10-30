import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import test from "node:test";

import {
  answerDeterministic,
  answerLoadedQuestion,
  buildFacts,
  type ProjectSnapshot,
} from "@/lib/assistant/answer";
import {
  ANSWER_QUESTION_TASK,
  answerQuestionInputSchema,
  buildAnswerQuestionPrompt,
} from "@/lib/ai/tasks/answer_question";
import { taskCacheKey, writeTaskCache } from "@/lib/ai/client";

function snapshot(overrides: Partial<ProjectSnapshot> = {}): ProjectSnapshot {
  return {
    id: "proj-1",
    name: "Water Tank Monitor",
    brief: "A tank monitor.",
    status: "active",
    requirements: [
      { text: "Measure level.", kind: "mandatory", status: "confirmed" },
    ],
    constraints: [],
    latestRun: null,
    components: [
      {
        id: "c1",
        partNumber: "A-1",
        manufacturer: "Acme",
        category: null,
        quantity: 2,
        unitPriceCents: 250,
      },
    ],
    currentArtifacts: [{ kind: "firmware", name: "FW", version: "v0.3.0" }],
    decisions: [{ title: "Use an LDO" }],
    validationTests: [{ name: "Sleep run", status: "pending" }],
    selectedResources: [],
    resourceIndexSize: 0,
    ...overrides,
  };
}

const TERMS = ["A-1", "FW"];

test("BOM questions are answered from arithmetic", async () => {
  const answer = answerDeterministic(
    snapshot(),
    "What does the BOM total?",
    TERMS,
  )!;

  assert.equal(answer.source, "computed");
  assert.match(answer.text, /\$5\.00/);
  assert.ok(
    answer.citations.some((c) => c.href === "/projects/proj-1?tab=components"),
  );
});

test("missing comparison runs point at the tab instead of guessing", async () => {
  const answer = answerDeterministic(
    snapshot(),
    "Which part won the comparison?",
    TERMS,
  )!;

  assert.equal(answer.source, "computed");
  assert.match(answer.text, /No comparison has been run yet/);
});

test("comparison verdicts come from the stored run", async () => {
  const answer = answerDeterministic(
    snapshot({
      latestRun: {
        category: "ldo",
        summary: "TPS7A02 ranks first.",
        explanationStatus: "deterministic",
        candidates: [
          { partNumber: "TPS7A02", score: 100, status: "pass", reason: "Meets all constraints." },
        ],
      },
    }),
    "Explain the trade-offs",
    TERMS,
  )!;

  assert.equal(answer.source, "computed");
  assert.match(answer.text, /TPS7A02/);
});

test("current versions, decisions, and validation read from storage", async () => {
  const versions = answerDeterministic(
    snapshot(),
    "Which versions are current?",
    TERMS,
  )!;
  assert.match(versions.text, /FW v0\.3\.0/);

  const decisions = answerDeterministic(
    snapshot(),
    "Why did we choose the LDO?",
    TERMS,
  )!;
  assert.match(decisions.text, /Use an LDO/);

  const tests = answerDeterministic(
    snapshot(),
    "Did validation pass?",
    TERMS,
  )!;
  assert.match(tests.text, /Sleep run: pending/);
});

test("catalog questions list global catalog matches", () => {
  const answer = answerDeterministic(
    snapshot({
      catalogMatches: [
        {
          partNumber: "TPS7A02",
          manufacturer: "Texas Instruments",
          category: "ldo",
          priceUsd: 0.35,
          description: "Low dropout regulator.",
        },
      ],
    }),
    "What LDOs under $1 do we have?",
    TERMS,
  )!;

  assert.equal(answer.source, "computed");
  assert.match(answer.text, /TPS7A02/);
  assert.ok(answer.citations.some((citation) => citation.href === "/catalog"));
});

test("capabilities describe the assistant honestly", async () => {
  const answer = answerDeterministic(snapshot(), "What can you do?", TERMS)!;

  assert.equal(answer.source, "computed");
  assert.match(answer.text, /never invent/);
});

test("the main MCU is identified from catalog categories", async () => {
  const withMcu = snapshot({
    components: [
      {
        id: "c1",
        partNumber: "ESP32-WROOM-32E",
        manufacturer: "Espressif",
        category: "mcu",
        quantity: 1,
        unitPriceCents: 320,
      },
      {
        id: "c2",
        partNumber: "MB7040",
        manufacturer: "MaxBotix",
        category: "level-sensor",
        quantity: 1,
        unitPriceCents: 9995,
      },
    ],
  });

  const answer = answerDeterministic(
    withMcu,
    "What is the main mcu in my project?",
    ["ESP32-WROOM-32E", "MB7040"],
  )!;

  assert.equal(answer.source, "computed");
  assert.match(answer.text, /Main MCU: ESP32-WROOM-32E/);
  assert.match(answer.text, /MB7040/);
  assert.ok(
    answer.citations.some((c) => c.href.endsWith("?tab=components")),
  );
});

test("a mentioned part gets the spotlight", async () => {
  const withMcu = snapshot({
    components: [
      {
        id: "c1",
        partNumber: "ESP32-WROOM-32E",
        manufacturer: "Espressif",
        category: "mcu",
        quantity: 1,
        unitPriceCents: 320,
      },
      {
        id: "c2",
        partNumber: "MB7040",
        manufacturer: "MaxBotix",
        category: "level-sensor",
        quantity: 1,
        unitPriceCents: 9995,
      },
    ],
  });

  const answer = answerDeterministic(withMcu, "Tell me about the MB7040", [
    "ESP32-WROOM-32E",
    "MB7040",
  ]);

  assert.match(answer!.text, /MB7040/);
  assert.doesNotMatch(answer!.text, /ESP32-WROOM-32E/);
});

test("no MCU present is stated honestly", async () => {
  const answer = answerDeterministic(
    snapshot(),
    "Which microcontroller do we use?",
    TERMS,
  )!;

  assert.match(answer.text, /No MCU in the selected parts/);
});

test("off-topic questions fall back to parts, never verse", async () => {
  const answer = answerDeterministic(
    snapshot(),
    "Write me a poem about capacitors",
    TERMS,
  )!;

  assert.equal(answer.source, "computed");
  assert.match(answer.text, /Selected parts/);
});

test("unanswerable open questions fail loudly without a model", async () => {
  const cacheDir = `/tmp/opencode/harmos-answer-unavail-${process.pid}`;
  const previousCacheDir = process.env.HARMOS_CACHE_DIR;
  const previousKey = process.env.OPENAI_API_KEY;
  process.env.HARMOS_CACHE_DIR = cacheDir;
  delete process.env.OPENAI_API_KEY;

  try {
    const answer = await answerLoadedQuestion(
      snapshot(),
      "Write me a haiku about the moon",
      TERMS,
    );

    assert.equal(answer.source, "unavailable");
    assert.match(answer.text, /AI_API_KEY/);
  } finally {
    if (previousCacheDir === undefined) {
      delete process.env.HARMOS_CACHE_DIR;
    } else {
      process.env.HARMOS_CACHE_DIR = previousCacheDir;
    }
    if (previousKey !== undefined) {
      process.env.OPENAI_API_KEY = previousKey;
    }
    await rm(cacheDir, { recursive: true, force: true });
  }
});

test("facts snapshot stays bounded", () => {
  const big = snapshot({
    requirements: Array.from({ length: 50 }, (_, i) => ({
      text: `Requirement number ${i} with a fairly long description attached.`,
      kind: "mandatory",
      status: "confirmed",
    })),
  });

  assert.ok(buildFacts(big).length <= 4100);
  assert.match(buildFacts(snapshot()), /BOM total: \$5\.00/);
  assert.match(buildFacts(snapshot()), /A-1 \(Acme\)/);
});

test("AI answers first when a cached response exists", async () => {
  const cacheDir = `/tmp/opencode/harmos-answer-first-${process.pid}`;
  const previousCacheDir = process.env.HARMOS_CACHE_DIR;
  process.env.HARMOS_CACHE_DIR = cacheDir;

  try {
    const question = "Which part should I pick for the radio?";
    const facts = buildFacts(snapshot());
    const prompt = buildAnswerQuestionPrompt({
      question,
      project: { name: "Water Tank Monitor", brief: "A tank monitor." },
      facts,
    });
    const key = taskCacheKey(
      ANSWER_QUESTION_TASK,
      prompt,
      answerQuestionInputSchema,
    );
    await writeTaskCache(ANSWER_QUESTION_TASK, key, {
      answer: "Pick the ESP32 module: it is the only radio in the BOM.",
      citations: [],
      followUps: [],
    });

    const answer = await answerLoadedQuestion(snapshot(), question, TERMS);

    assert.equal(answer.source, "ai");
    assert.match(answer.text, /ESP32 module/);
  } finally {
    if (previousCacheDir === undefined) {
      delete process.env.HARMOS_CACHE_DIR;
    } else {
      process.env.HARMOS_CACHE_DIR = previousCacheDir;
    }
    await rm(cacheDir, { recursive: true, force: true });
  }
});
