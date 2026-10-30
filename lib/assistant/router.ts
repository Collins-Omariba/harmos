/**
 * Deterministic intent router for the project assistant. No model involved:
 * the question is matched against keyword patterns plus terms extracted from
 * the project's own data (part numbers, categories, artifact names), so the
 * router can never invent an intent — only recognize one or fall through to
 * the grounded AI path.
 */

export type AssistantIntent =
  | "bom_cost"
  | "catalog"
  | "comparison"
  | "components"
  | "current_versions"
  | "requirements"
  | "resources"
  | "validation"
  | "decisions"
  | "project_status"
  | "suggest"
  | "capabilities"
  | "open";

export type RoutedQuestion = {
  intent: AssistantIntent;
  mentions: string[];
};

const PATTERNS: { intent: AssistantIntent; patterns: RegExp[] }[] = [
  {
    intent: "catalog",
    patterns: [
      /catalog/,
      /do we have/,
      /what .* do we have/,
      /in stock/,
      /available (parts|components)/,
      /under \$?\d/,
      /below \$?\d/,
    ],
  },
  {
    intent: "bom_cost",
    patterns: [/\bbom\b/, /\bcost\b/, /budget/, /price/, /total/, /how much/, /cheap|expensive/],
  },
  {
    intent: "comparison",
    patterns: [/compar/, /trade.?off/, /verdict/, /\bvs\b|\bversus\b/, /which .* (better|best)/, /winner|rank/],
  },
  {
    intent: "components",
    patterns: [
      /which .* (part|candidate)/,
      /mcu|microcontroller|processor|\bcpu\b/,
      /\b(sensors?|chips?|transistors?|resistors?|capacitors?|inductors?|diodes?|parts?|components?)\b/,
      /what .*(use|using|main|inside)/,
      /which .*(use|using)/,
      /on the board/,
    ],
  },
  {
    intent: "current_versions",
    patterns: [/current version/, /\blatest\b/, /which version/],
  },
  {
    intent: "requirements",
    patterns: [/requirement/, /constraint/, /must |must-|spec\b|specified/, /hard .*rule/],
  },
  {
    intent: "resources",
    patterns: [/resource/, /source/, /datasheet/, /\bcite\b|\bcitation\b/, /reference/, /research/, /document/, /app.?note/, /standard/],
  },
  {
    intent: "validation",
    patterns: [/validat/, /\btest\b|tests|tested|testing/, /\bpass\b|\bfail\b/],
  },
  {
    intent: "decisions",
    patterns: [/decis/, /rationale/, /why .* (chose|choose|pick|use|using)/],
  },
  {
    intent: "project_status",
    patterns: [/status/, /overview/, /summary|progress/, /where .* (at|stand)/, /what.*project.*(about|doing)/, /how.*going/],
  },
  {
    intent: "suggest",
    patterns: [/suggest/, /recommend/, /what should/, /which .* should/, /idea/, /option/],
  },
  {
    intent: "capabilities",
    patterns: [/^help/, /what can you/, /how do (you|i)/, /what do you/],
  },
];

export function routeQuestion(
  question: string,
  knownTerms: string[] = [],
): RoutedQuestion {
  const normalized = question.toLowerCase();

  let intent: AssistantIntent = "open";
  for (const { intent: candidate, patterns } of PATTERNS) {
    if (patterns.some((pattern) => pattern.test(normalized))) {
      intent = candidate;
      break;
    }
  }

  const mentions = knownTerms.filter(
    (term) =>
      term.length >= 3 && normalized.includes(term.toLowerCase()),
  );

  return { intent, mentions: [...new Set(mentions)] };
}

export function intentLabel(intent: AssistantIntent): string {
  switch (intent) {
    case "bom_cost":
      return "Bill of materials";
    case "catalog":
      return "Catalog";
    case "comparison":
      return "Comparison";
    case "components":
      return "Components";
    case "current_versions":
      return "Current versions";
    case "requirements":
      return "Requirements";
    case "resources":
      return "Research";
    case "validation":
      return "Validation";
    case "decisions":
      return "Decisions";
    case "project_status":
      return "Project status";
    case "suggest":
      return "Suggestions";
    case "capabilities":
      return "Help";
    case "open":
      return "General";
  }
}
