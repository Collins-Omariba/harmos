import { z } from "zod";

import { runTask } from "@/lib/ai/client";

/**
 * find_sources
 *
 * Model-native web search for the research index. The model browses for the
 * query and returns candidate sources; every URL is validated (http/https
 * only) and deduplicated against the index before anything is stored, and
 * importing a source still requires nothing beyond the existing add flow —
 * the action files each hit as its own indexed resource for the user to keep
 * or delete. Structured output, disk-cached, logged.
 */

export const findSourcesInputSchema = z.object({
  query: z.string(),
  excludeUrls: z.array(z.string()),
});

export const findSourcesOutputSchema = z.object({
  sources: z.array(
    z.object({
      title: z.string().min(1),
      url: z.string().min(1),
      snippet: z.string().min(1),
    }),
  ),
});

export type FindSourcesOutput = z.infer<typeof findSourcesOutputSchema>;

export const FIND_SOURCES_TASK = "find_sources";

export function buildFindSourcesPrompt(input: {
  query: string;
  excludeUrls: string[];
}): string {
  return [
    "Use the live web to find reference material for a hardware engineering project.",
    "Prefer manufacturer datasheets and product pages, then app notes and standards. Skip marketing pages, forums, and shops.",
    "Return 3-8 results. Snippet: one factual sentence on what the source covers.",
    "Never invent a URL: every url must be a page the search actually returned.",
    "Do not return any of these already-indexed URLs:",
    JSON.stringify(input.excludeUrls.slice(0, 200)),
    "Return JSON with this exact shape:",
    '{"sources": [{"title": string, "url": string, "snippet": string}]}',
    "",
    `Query: ${input.query}`,
  ].join("\n");
}

export type FoundSource = { title: string; url: string; snippet: string };

function isWebUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export async function findSources(input: {
  query: string;
  excludeUrls: string[];
}): Promise<{ sources: FoundSource[] }> {
  const result = await runTask(
    FIND_SOURCES_TASK,
    findSourcesInputSchema,
    findSourcesOutputSchema,
    buildFindSourcesPrompt(input),
    { webSearch: true },
  );

  const excluded = new Set(input.excludeUrls);
  const seen = new Set<string>();

  return {
    sources: result.sources.filter((source) => {
      if (!isWebUrl(source.url) || excluded.has(source.url)) {
        return false;
      }
      if (seen.has(source.url)) {
        return false;
      }
      seen.add(source.url);
      return true;
    }),
  };
}
