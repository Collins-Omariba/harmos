import { answerQuestion } from "@/lib/ai/tasks/answer_question";
import { parseCandidatePayload } from "@/lib/comparison/constraints";
import { computeBomTotals, formatCents } from "@/lib/bom/totals";
import { suggestConstraints } from "@/lib/comparison/suggest";
import { routeQuestion, type AssistantIntent } from "@/lib/assistant/router";

export type SnapshotCandidate = {
  partNumber: string;
  score: number;
  status: string;
  reason: string;
};

export type ProjectSnapshot = {
  id: string;
  name: string;
  brief: string;
  status: string;
  requirements: { text: string; kind: string; status: string }[];
  constraints: {
    label: string;
    metric: string;
    operator: string;
    value: string | number;
    unit: string | null;
    kind: string;
  }[];
  latestRun: {
    category: string;
    summary: string;
    explanationStatus: string;
    candidates: SnapshotCandidate[];
  } | null;
  components: {
    id: string;
    partNumber: string;
    manufacturer: string;
    category: string | null;
    quantity: number;
    unitPriceCents: number | null;
  }[];
  currentArtifacts: { kind: string; name: string; version: string }[];
  decisions: { title: string }[];
  validationTests: { name: string; status: string }[];
  selectedResources: { title: string; url: string; note: string }[];
  resourceIndexSize: number;
  catalogMatches?: {
    partNumber: string;
    manufacturer: string;
    category: string;
    priceUsd: number | null;
    description: string;
  }[];
};

export type AssistantCitation = { label: string; href: string };

export type AssistantAnswer = {
  text: string;
  citations: AssistantCitation[];
  followUps: string[];
  source: "computed" | "ai" | "unavailable";
};

function tab(projectId: string, tab: string): string {
  return `/projects/${projectId}?tab=${tab}`;
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function buildFacts(snapshot: ProjectSnapshot): string {
  const lines: string[] = [
    `Status: ${snapshot.status}.`,
    `Requirements (${snapshot.requirements.length}):`,
    ...snapshot.requirements
      .slice(0, 12)
      .map((r) => `- [${r.kind}/${r.status}] ${r.text}`),
    `Constraints (${snapshot.constraints.length}):`,
    ...snapshot.constraints.slice(0, 12).map((c) => `- ${c.label}`),
  ];

  if (snapshot.latestRun) {
    const run = snapshot.latestRun;
    lines.push(`Latest comparison (${run.category}): ${run.summary}`);
    for (const candidate of run.candidates.slice(0, 5)) {
      lines.push(
        `- ${candidate.partNumber}: ${candidate.score}/100 ${candidate.status} — ${truncate(candidate.reason, 200)}`,
      );
    }
  } else {
    lines.push("No comparison run yet.");
  }

  const totals = computeBomTotals(snapshot.components);
  lines.push(
    `BOM total: ${formatCents(totals.totalCents)} across ${snapshot.components.length} lines (${totals.pricedLines} priced, ${totals.unpricedLines} unpriced).`,
  );
  lines.push("Selected parts:");
  for (const component of snapshot.components.slice(0, 15)) {
    lines.push(
      `- ${component.partNumber} (${component.manufacturer}${component.category ? `, ${component.category}` : ""}) ×${component.quantity}`,
    );
  }

  lines.push("Current artifact versions:");
  for (const artifact of snapshot.currentArtifacts.slice(0, 10)) {
    lines.push(`- ${artifact.kind} ${artifact.name} ${artifact.version}`);
  }

  lines.push(
    `Decisions (${snapshot.decisions.length}): ${snapshot.decisions.map((d) => d.title).join("; ")}`,
  );
  lines.push(
    `Validation: ${snapshot.validationTests.map((t) => `${t.name} (${t.status})`).join("; ") || "none recorded"}`,
  );
  lines.push(
    `Selected sources (${snapshot.selectedResources.length} of ${snapshot.resourceIndexSize} indexed):`,
    ...snapshot.selectedResources.map((r) => `- ${r.title}: ${r.note || r.url}`),
  );

  if (snapshot.catalogMatches && snapshot.catalogMatches.length > 0) {
    lines.push("Catalog matches for this question (global catalog, not necessarily selected):");
    for (const part of snapshot.catalogMatches.slice(0, 8)) {
      lines.push(
        `- ${part.partNumber} (${part.manufacturer}, ${part.category}${part.priceUsd !== null ? `, $${part.priceUsd.toFixed(2)}` : ", no price"}): ${truncate(part.description, 140)}`,
      );
    }
  }

  const joined = lines.join("\n");
  return joined.length > 4000 ? `${joined.slice(0, 4000)}…` : joined;
}

function computed(
  text: string,
  citations: AssistantCitation[],
  followUps: string[],
): AssistantAnswer {
  return { text, citations, followUps, source: "computed" };
}

function handleIntent(
  intent: AssistantIntent,
  snapshot: ProjectSnapshot,
  mentions: string[],
  question: string,
): AssistantAnswer | null {
  const id = snapshot.id;

  switch (intent) {
    case "catalog": {
      const matches = snapshot.catalogMatches ?? [];
      if (matches.length === 0) {
        return computed(
          "No catalog parts match that yet. Open the catalog to propose or add the missing part.",
          [{ label: "Catalog", href: "/catalog" }],
          ["What passed the comparison?", "What does the BOM total?"],
        );
      }
      return computed(
        `Catalog matches: ${matches
          .map(
            (part) =>
              `${part.partNumber} (${part.manufacturer}, ${part.category}${part.priceUsd !== null ? `, $${part.priceUsd.toFixed(2)}` : ", no price"})`,
          )
          .join("; ")}. These are catalog rows, not parts selected into this project yet.`,
        [{ label: "Catalog", href: "/catalog" }],
        ["Add the best one to the BOM", "What passed the comparison?"],
      );
    }

    case "bom_cost": {
      const totals = computeBomTotals(snapshot.components);
      const unpriced = snapshot.components.filter(
        (c) => c.unitPriceCents === null,
      );
      return computed(
        `The BOM totals ${formatCents(totals.totalCents)} across ${snapshot.components.length} lines (${totals.pricedLines} priced${totals.unpricedLines > 0 ? `, ${totals.unpricedLines} unpriced and excluded` : ""}).` +
          (unpriced.length > 0
            ? ` Missing prices: ${unpriced.map((c) => `${c.partNumber} ×${c.quantity}`).join(", ")}.`
            : " Every line is priced."),
        [{ label: "Components and BOM", href: tab(id, "components") }],
        ["Which lines are unpriced?", "What passed the comparison?"],
      );
    }

    case "comparison": {
      const run = snapshot.latestRun;
      if (!run) {
        return computed(
          "No comparison has been run yet. Pick a category and candidates on the Comparison tab and I can explain the results.",
          [{ label: "Comparison", href: tab(id, "comparison") }],
          ["What constraints do we have?"],
        );
      }
      const top = run.candidates[0];
      return computed(
        `${truncate(run.summary, 400)}${top ? ` Top candidate: ${top.partNumber} at ${top.score}/100 (${top.status}).` : ""}`.trim(),
        [{ label: "Comparison results", href: tab(id, "comparison") }],
        ["Which candidates failed?", "What does the BOM total?"],
      );
    }

    case "components": {
      if (snapshot.components.length === 0) {
        return computed(
          "No components selected yet. Add parts on the Components tab, or compare catalog candidates first.",
          [{ label: "Components", href: tab(id, "components") }],
          ["What passed the comparison?"],
        );
      }

      const mentioned = snapshot.components.filter((c) =>
        mentions.some((m) => m.toLowerCase() === c.partNumber.toLowerCase()),
      );
      const focus = mentioned.length > 0 ? mentioned : snapshot.components;
      const describe = (c: (typeof focus)[number]) =>
        `${c.partNumber} (${c.manufacturer}${c.category ? `, ${c.category}` : ""}) ×${c.quantity}`;

      const mcuParts = focus.filter((c) => c.category === "mcu");
      const asksMcu = /mcu|microcontroller|processor|\bcpu\b|main/.test(
        question.toLowerCase(),
      );
      const prefix =
        asksMcu && mcuParts.length > 0
          ? `Main MCU${mcuParts.length === 1 ? "" : "s"}: ${mcuParts.map((c) => `${c.partNumber} by ${c.manufacturer}`).join("; ")}. Full selection: `
          : asksMcu
            ? "No MCU in the selected parts. Full selection: "
            : "Selected parts: ";

      return computed(
        prefix + focus.map(describe).join("; ") + ".",
        [{ label: "Components", href: tab(id, "components") }],
        ["What does the BOM total?", "What passed the comparison?"],
      );
    }

    case "current_versions": {
      if (snapshot.currentArtifacts.length === 0) {
        return computed(
          "No artifact is marked current yet. Open the Artifacts tab and star one version per item to mark it.",
          [{ label: "Artifacts", href: tab(id, "artifacts") }],
          [],
        );
      }
      return computed(
        `Current versions: ${snapshot.currentArtifacts.map((a) => `${a.kind} ${a.name} ${a.version}`).join("; ")}.`,
        [{ label: "Artifacts", href: tab(id, "artifacts") }],
        ["What changed recently?", "What are the open requirements?"],
      );
    }

    case "requirements": {
      if (snapshot.requirements.length === 0) {
        return computed("No requirements recorded yet.", [
          { label: "Overview", href: tab(id, "overview") },
        ], []);
      }
      const mandatory = snapshot.requirements.filter((r) => r.kind === "mandatory").length;
      return computed(
        `${snapshot.requirements.length} requirements (${mandatory} mandatory). ` +
          snapshot.requirements
            .slice(0, 4)
            .map((r) => `“${truncate(r.text, 90)}” [${r.status}]`)
            .join(" "),
        [{ label: "Constraint ledger", href: tab(id, "overview") }],
        ["What constraints score the comparison?", "What is still unconfirmed?"],
      );
    }

    case "resources": {
      if (snapshot.selectedResources.length === 0) {
        return computed(
          `Nothing selected yet from ${snapshot.resourceIndexSize} indexed sources. Run the AI selection or bookmark rows on the Research tab.`,
          [{ label: "Research", href: tab(id, "research") }],
          ["What is in the index?"],
        );
      }
      return computed(
        `Selected ${snapshot.selectedResources.length} sources: ` +
          snapshot.selectedResources
            .map((r) => `${r.title}${r.note ? ` — ${truncate(r.note, 100)}` : ""}`)
            .join("; ") +
          ".",
        [
          snapshot.selectedResources[0]
            ? { label: "Selected references", href: tab(id, "research") }
            : { label: "Research", href: tab(id, "research") },
        ],
        ["What requirements do we have?"],
      );
    }

    case "validation": {
      if (snapshot.validationTests.length === 0) {
        return computed("No validation tests recorded yet.", [
          { label: "Overview", href: tab(id, "overview") },
        ], []);
      }
      return computed(
        snapshot.validationTests
          .map((t) => `${t.name}: ${t.status}`)
          .join("; ") + ".",
        [{ label: "Validation", href: tab(id, "overview") }],
        ["What decisions are recorded?"],
      );
    }

    case "decisions": {
      if (snapshot.decisions.length === 0) {
        return computed("No decisions recorded yet.", [
          { label: "Decisions", href: tab(id, "decisions") },
        ], []);
      }
      return computed(
        `${snapshot.decisions.length} recorded: ` +
          snapshot.decisions.map((d) => d.title).join("; ") +
          ".",
        [{ label: "Decision log", href: tab(id, "decisions") }],
        ["Why did we choose that?"],
      );
    }

    case "project_status": {
      const totals = computeBomTotals(snapshot.components);
      const run = snapshot.latestRun;
      return computed(
        `${snapshot.name} is ${snapshot.status}: ${snapshot.requirements.length} requirements, ` +
          `${snapshot.components.length} components (${formatCents(totals.totalCents)} BOM), ` +
          `${snapshot.decisions.length} decisions, ` +
          (run
            ? `latest comparison in ${run.category} with ${run.candidates.length} candidates.`
            : "no comparison run yet."),
        [{ label: "Overview", href: tab(id, "overview") }],
        ["What passed the comparison?", "What does the BOM total?"],
      );
    }

    case "suggest": {
      const suggestions = suggestConstraints({
        brief: snapshot.brief,
        packIds: [],
      }).slice(0, 3);
      if (suggestions.length === 0) {
        return computed(
          "Nothing in the brief triggers a suggestion rule right now. Add packs when creating a project, or describe power, environment, or radios in the brief.",
          [{ label: "Comparison", href: tab(id, "comparison") }],
          ["What constraints do we have?"],
        );
      }
      return computed(
        "Worth considering as project constraints: " +
          suggestions
            .map((s) => `${s.label} — ${truncate(s.reason, 120)}`)
            .join(" ") +
          " Add the ones you want under Constraints on the Comparison tab.",
        [{ label: "Constraints", href: tab(id, "comparison") }],
        ["What constraints do we have?"],
      );
    }

    case "capabilities":
      return computed(
        "I answer from your stored project data: BOM totals, comparison verdicts, current versions, requirements, selected sources, tests, and decisions. I also predict extra constraints from a brief. I never invent data — if it is not stored, I will say what is missing and where to add it.",
        [{ label: "Overview", href: tab(id, "overview") }],
        ["What does the BOM total?", "What passed the comparison?", "What are the requirements?"],
      );

    case "open":
      return null;
  }
}

export async function answerWithAi(
  snapshot: ProjectSnapshot,
  question: string,
): Promise<AssistantAnswer> {
  const result = await answerQuestion({
    question,
    project: { name: snapshot.name, brief: snapshot.brief },
    facts: buildFacts(snapshot),
  });

  return {
    text: result.answer,
    citations: result.citations.map((citation) => ({
      label: citation.label,
      href: citation.href,
    })),
    followUps: result.followUps,
    source: "ai",
  };
}

export function answerDeterministic(
  snapshot: ProjectSnapshot,
  question: string,
  knownTerms: string[],
): AssistantAnswer | null {
  const { intent, mentions } = routeQuestion(question, knownTerms);
  // A question naming a selected part is about components even when no
  // keyword fires — e.g. "Tell me about the MB7040".
  const namesPart = mentions.some((mention) =>
    snapshot.components.some(
      (component) =>
        component.partNumber.toLowerCase() === mention.toLowerCase(),
    ),
  );
  const effectiveIntent =
    intent === "open" && namesPart ? "components" : intent;
  return handleIntent(effectiveIntent, snapshot, mentions, question);
}

/**
 * AI first, deterministic fallback. The model gets the whole snapshot and
 * answers freely; only when it cannot (no key, demo mode, network error,
 * invalid output) do the code-computed answers take over. Unanswerable
 * questions degrade to an honest pointer at what to add and where.
 */
export async function answerLoadedQuestion(
  snapshot: ProjectSnapshot,
  question: string,
  knownTerms: string[],
): Promise<AssistantAnswer> {
  try {
    return await answerWithAi(snapshot, question);
  } catch {
    const direct = answerDeterministic(snapshot, question, knownTerms);
    if (direct) {
      return direct;
    }

    return {
      text:
        "I could not reach the model, and nothing stored here answers that. " +
        "Ask about the BOM total, comparison results, current versions, requirements, " +
        "selected sources, tests, or decisions — those I compute directly — or set AI_API_KEY in .env.",
      citations: [{ label: "Overview", href: tab(snapshot.id, "overview") }],
      followUps: ["What does the BOM total?", "What passed the comparison?"],
      source: "unavailable",
    };
  }
}

export function candidateSummaries(
  candidates: { dataJson: string; score: number; verdict: string; reason: string; partNumber: string }[],
): SnapshotCandidate[] {
  return candidates.map((candidate) => {
    const payload = parseCandidatePayload(candidate.dataJson);
    return {
      partNumber: candidate.partNumber,
      score: candidate.score,
      status: candidate.verdict,
      reason: payload?.explanation?.reason ?? candidate.reason,
    };
  });
}
