/**
 * Research source kinds. Web search is model-native: tasks that benefit from
 * browsing pass { webSearch: true } to runTask(), which adds the standard
 * web_search_options to the chat completion. No search API key exists
 * anywhere in this codebase.
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
