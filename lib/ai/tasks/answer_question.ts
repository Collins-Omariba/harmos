import { z } from "zod";

import { runTask } from "@/lib/ai/client";

/**
 * answer_question
 *
 * The assistant's open-ended path. The model receives ONLY a snapshot of
 * stored project facts — never the open web, never live data — and must
 * answer from those facts with citations to in-app locations. Citation hrefs
 * are validated against an allowlist before anything is shown, so a
 * hallucinating model degrades to uncited prose rather than fake links.
 * Deterministic intents bypass this task entirely and answer from code.
 */

export const answerQuestionInputSchema = z.object({
  question: z.string(),
  project: z.object({
    name: z.string(),
    brief: z.string(),
  }),
  facts: z.string(),
});

export const answerQuestionOutputSchema = z.object({
  answer: z.string().min(1),
  citations: z.array(
    z.object({
      label: z.string().min(1),
      href: z.string().min(1),
    }),
  ),
  followUps: z.array(z.string().min(1)).max(4),
});

export type AnswerQuestionOutput = z.infer<typeof answerQuestionOutputSchema>;

export const ANSWER_QUESTION_TASK = "answer_question";

const ALLOWED_HREF = /^\/(projects\/[A-Za-z0-9_-]+(\?tab=[a-z]+)?|catalog)$/;

export function isAllowedHref(href: string): boolean {
  return ALLOWED_HREF.test(href);
}

export function buildAnswerQuestionPrompt(input: {
  question: string;
  project: { name: string; brief: string };
  facts: string;
}): string {
  return [
    "You are answering a question about the user's hardware project.",
    "Use ONLY the facts below. Never invent parts, numbers, versions, test results, or decisions that are not stated there.",
    "If the facts do not cover the question, say what is missing and where to add it — do not guess.",
    "Cite in-app locations for every claim, using hrefs from this exact set of shapes: /projects/<id>, /projects/<id>?tab=<overview|components|artifacts|decisions|research|comparison|graph>, /catalog.",
    "Keep the answer short: two to five sentences plus the citations. No markdown headings.",
    "Return JSON with this exact shape:",
    '{"answer": string, "citations": [{"label": string, "href": string}], "followUps": string[]}',
    "with at most 4 follow-up question suggestions.",
    "",
    `Project: ${input.project.name} — ${input.project.brief}`,
    "",
    "Facts:",
    input.facts,
    "",
    `Question: ${input.question}`,
  ].join("\n");
}

export async function answerQuestion(input: {
  question: string;
  project: { name: string; brief: string };
  facts: string;
}): Promise<AnswerQuestionOutput> {
  const result = await runTask(
    ANSWER_QUESTION_TASK,
    answerQuestionInputSchema,
    answerQuestionOutputSchema,
    buildAnswerQuestionPrompt(input),
  );

  return {
    answer: result.answer,
    citations: result.citations.filter((citation) =>
      isAllowedHref(citation.href),
    ),
    followUps: result.followUps.slice(0, 4),
  };
}
