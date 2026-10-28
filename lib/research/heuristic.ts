/**
 * Keyword-overlap fallback for resource selection. Used only when the AI
 * cannot run (no key, demo mode, network error): it ranks the index against
 * the brief and clearly labels its picks as heuristic so nobody mistakes them
 * for model judgment. Manual bookmarking always stays available.
 */

const STOPWORDS = new Set(
  "a,an,the,and,or,for,with,from,that,this,these,those,will,must,need,needs,using,use,used,over,into,more,than,then,also,each,other,our,your,its,via,per,over,under,between,across,project,needs".split(
    ",",
  ),
);

export function briefKeywords(brief: string): string[] {
  const words = brief
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 4 && !STOPWORDS.has(word));
  return [...new Set(words)];
}

export type HeuristicCandidate = {
  id: string;
  title: string;
  score: number;
  matched: string[];
};

export function scoreResourceOverlap(
  keywords: string[],
  resource: { title: string; summary: string; tags: string[] },
): { score: number; matched: string[] } {
  const haystacks = {
    title: resource.title.toLowerCase(),
    rest: `${resource.summary} ${resource.tags.join(" ")}`.toLowerCase(),
  };

  let score = 0;
  const matched: string[] = [];

  for (const keyword of keywords) {
    const inTitle = haystacks.title.includes(keyword);
    const inRest = haystacks.rest.includes(keyword);
    if (inTitle || inRest) {
      score += inTitle ? 2 : 0;
      score += inRest ? 1 : 0;
      matched.push(keyword);
    }
  }

  return { score, matched };
}

export function selectTopResources<
  T extends { id: string; title: string; summary: string; tags: string[] },
>(
  resources: T[],
  brief: string,
  limit = 3,
): (T & { score: number; matched: string[] })[] {
  const keywords = briefKeywords(brief);

  return resources
    .map((resource) => ({
      ...resource,
      ...scoreResourceOverlap(keywords, {
        title: resource.title,
        summary: resource.summary,
        tags: resource.tags,
      }),
    }))
    .filter((resource) => resource.score > 0)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, limit);
}
