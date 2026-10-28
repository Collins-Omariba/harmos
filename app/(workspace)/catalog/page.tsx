import { CatalogManager } from "@/components/catalog-manager";
import { CatalogProposer, type ProposalRow } from "@/components/catalog-proposer";
import { catalog } from "@/lib/catalog";
import { prisma } from "@/lib/db";
import { padCount } from "@/lib/format";

export const dynamic = "force-dynamic";

function parseProposalCandidate(raw: string): ProposalRow["candidate"] {
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }
    const candidate = value as Record<string, unknown>;
    if (
      typeof candidate.partNumber !== "string" ||
      typeof candidate.manufacturer !== "string" ||
      typeof candidate.category !== "string"
    ) {
      return null;
    }
    return {
      partNumber: candidate.partNumber,
      manufacturer: candidate.manufacturer,
      category: candidate.category,
      description: typeof candidate.description === "string" ? candidate.description : "",
      package: typeof candidate.package === "string" ? candidate.package : "",
      datasheetUrl: typeof candidate.datasheetUrl === "string" ? candidate.datasheetUrl : null,
      sourceUrl: typeof candidate.sourceUrl === "string" ? candidate.sourceUrl : null,
      specs:
        candidate.specs && typeof candidate.specs === "object" && !Array.isArray(candidate.specs)
          ? (candidate.specs as Record<string, unknown>)
          : {},
      priceUsd: typeof candidate.priceUsd === "number" ? candidate.priceUsd : null,
      tags: Array.isArray(candidate.tags)
        ? candidate.tags.filter((tag): tag is string => typeof tag === "string")
        : [],
      confidence: candidate.confidence === "high" ? "high" : "low",
      note: typeof candidate.note === "string" ? candidate.note : "",
      warnings: Array.isArray(candidate.warnings)
        ? candidate.warnings.filter((w): w is string => typeof w === "string")
        : [],
    };
  } catch {
    return null;
  }
}

export default async function CatalogPage() {
  const parts = await catalog.listParts();
  const proposalRows = await prisma.catalogProposal.findMany({
    where: { status: "pending" },
    orderBy: { createdAt: "desc" },
  });
  const proposals: ProposalRow[] = proposalRows.map((row) => ({
    id: row.id,
    request: row.request,
    note: row.note,
    createdAt: row.createdAt,
    candidate: parseProposalCandidate(row.payloadJson),
  }));

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-8 md:px-8 lg:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="numeric text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Library / catalog
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-foreground">
            Component catalog
          </h1>
          <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Real parts with sourced specs. Seeded rows ship with the app;
            imported, custom, and agent-approved rows are yours — the seed
            fills gaps but never overwrites them.
          </p>
        </div>
        <span className="numeric text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          {padCount(parts.length)} parts
        </span>
      </div>

      <div className="mt-7 space-y-6">
        <CatalogProposer proposals={proposals} />
        <CatalogManager parts={parts} />
      </div>
    </div>
  );
}
