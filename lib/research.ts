/**
 * Research source kinds and the live-web-search feature flag.
 *
 * HARMOS_WEB_SEARCH=1 will route "web search" requests through an AI model
 * with a search tool, validating each hit before it enters the index. The
 * provider call is not wired yet: liveWebSearch() throws loudly instead of
 * silently falling back, so the flag can never produce half-live behavior.
 */

export const RESOURCE_KINDS = [
  "datasheet",
  "app-note",
  "standard",
  "reference",
  "other",
] as const;

export type ResourceKind = (typeof RESOURCE_KINDS)[number];

export function isResourceKind(value: string): value is ResourceKind {
  return (RESOURCE_KINDS as readonly string[]).includes(value);
}

export function webSearchEnabled(): boolean {
  return process.env.HARMOS_WEB_SEARCH === "1";
}

export type WebSearchHit = {
  title: string;
  url: string;
  snippet: string;
};

export async function liveWebSearch(query: string): Promise<WebSearchHit[]> {
  if (!webSearchEnabled()) {
    throw new Error("web_search_disabled");
  }
  throw new Error(`web_search_not_implemented:${query}`);
}
