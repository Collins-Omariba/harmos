import assert from "node:assert/strict";
import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { taskCacheKey, writeTaskCache } from "@/lib/ai/client";
import {
  ANSWER_QUESTION_TASK,
  answerQuestion,
  answerQuestionInputSchema,
  buildAnswerQuestionPrompt,
  isAllowedHref,
  type AnswerQuestionOutput,
} from "@/lib/ai/tasks/answer_question";

const input = {
  question: "Which LDO won the comparison?",
  project: { name: "Water Tank Monitor", brief: "A tank monitor." },
  facts: "Comparison run: TPS7A02 ranks first with 100/100.",
};

test("answer_question returns a validated cache hit and logs it", async () => {
  const cacheDir = `/tmp/opencode/harmos-answer-cache-${process.pid}`;
  const previousCacheDir = process.env.HARMOS_CACHE_DIR;
  process.env.HARMOS_CACHE_DIR = cacheDir;

  try {
    const prompt = buildAnswerQuestionPrompt(input);
    const key = taskCacheKey(
      ANSWER_QUESTION_TASK,
      prompt,
      answerQuestionInputSchema,
    );
    const cached: AnswerQuestionOutput = {
      answer: "TPS7A02 won with 100/100.",
      citations: [
        { label: "Comparison", href: "/projects/proj-1?tab=comparison" },
      ],
      followUps: ["What was second?"],
    };

    await writeTaskCache(ANSWER_QUESTION_TASK, key, cached);

    const result = await answerQuestion(input);

    assert.deepEqual(result, cached);

    const log = await readFile(
      path.resolve(process.cwd(), "logs", "ai.log"),
      "utf8",
    );
    const entry = log
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as { cacheKey?: string; status?: string })
      .find((line) => line.cacheKey === key);

    assert.equal(entry?.status, "cache_hit");
  } finally {
    if (previousCacheDir === undefined) {
      delete process.env.HARMOS_CACHE_DIR;
    } else {
      process.env.HARMOS_CACHE_DIR = previousCacheDir;
    }
    await rm(cacheDir, { recursive: true, force: true });
  }
});

test("answer_question drops citations pointing outside the app", async () => {
  const cacheDir = `/tmp/opencode/harmos-answer-filter-${process.pid}`;
  const previousCacheDir = process.env.HARMOS_CACHE_DIR;
  process.env.HARMOS_CACHE_DIR = cacheDir;

  try {
    const prompt = buildAnswerQuestionPrompt(input);
    const key = taskCacheKey(
      ANSWER_QUESTION_TASK,
      prompt,
      answerQuestionInputSchema,
    );
    await writeTaskCache(ANSWER_QUESTION_TASK, key, {
      answer: "TPS7A02 won.",
      citations: [
        { label: "Comparison", href: "/projects/proj-1?tab=comparison" },
        { label: "Evil", href: "https://evil.example/phish" },
        { label: "JS", href: "javascript:alert(1)" },
      ],
      followUps: [],
    });

    const result = await answerQuestion(input);

    assert.deepEqual(result.citations, [
      { label: "Comparison", href: "/projects/proj-1?tab=comparison" },
    ]);
  } finally {
    if (previousCacheDir === undefined) {
      delete process.env.HARMOS_CACHE_DIR;
    } else {
      process.env.HARMOS_CACHE_DIR = previousCacheDir;
    }
    await rm(cacheDir, { recursive: true, force: true });
  }
});

test("href allowlist accepts project tabs and catalog only", () => {
  assert.equal(isAllowedHref("/projects/abc"), true);
  assert.equal(isAllowedHref("/projects/abc?tab=comparison"), true);
  assert.equal(isAllowedHref("/catalog"), true);
  assert.equal(isAllowedHref("https://example.com/x"), false);
  assert.equal(isAllowedHref("/projects/abc?tab=comparison&evil=1"), false);
  assert.equal(isAllowedHref("javascript:alert(1)"), false);
});
