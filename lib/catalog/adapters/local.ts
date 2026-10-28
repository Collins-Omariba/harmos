import { prisma } from "@/lib/db";
import {
  CATALOG_CATEGORIES,
  isCatalogCategory,
  type CatalogAdapter,
  type CatalogFilter,
  type CatalogPart,
  type CatalogSpecs,
} from "@/lib/catalog/types";

type CatalogPartRow = {
  id: string;
  partNumber: string;
  manufacturer: string;
  category: string;
  description: string;
  package: string;
  datasheetUrl: string;
  sourceUrl: string;
  sourceRetrievedAt: Date;
  priceUsd: number | null;
  origin: string;
  specsJson: string;
  tags: string;
};

function parseSpecs(raw: string): CatalogSpecs {
  try {
    const value: unknown = JSON.parse(raw);
    return value && typeof value === "object" ? (value as CatalogSpecs) : {};
  } catch {
    return {};
  }
}

function toDomain(row: CatalogPartRow): CatalogPart {
  const category = isCatalogCategory(row.category)
    ? row.category
    : "level-sensor";

  return {
    id: row.id,
    partNumber: row.partNumber,
    manufacturer: row.manufacturer,
    category,
    description: row.description,
    package: row.package,
    datasheetUrl: row.datasheetUrl,
    sourceUrl: row.sourceUrl,
    sourceRetrievedAt: row.sourceRetrievedAt.toISOString(),
    priceUsd: row.priceUsd,
    origin:
      row.origin === "imported" || row.origin === "custom"
        ? row.origin
        : "seeded",
    tags: row.tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean),
    specs: {
      ...parseSpecs(row.specsJson),
      priceUsd: row.priceUsd ?? undefined,
    },
  };
}

function whereFromFilter(filter?: CatalogFilter) {
  if (!filter) {
    return undefined;
  }

  return {
    ...(filter.category ? { category: filter.category } : {}),
    ...(filter.categoryKeys?.length
      ? { category: { in: filter.categoryKeys } }
      : {}),
    ...(filter.search
      ? {
          OR: [
            { partNumber: { contains: filter.search } },
            { manufacturer: { contains: filter.search } },
            { description: { contains: filter.search } },
            { tags: { contains: filter.search } },
          ],
        }
      : {}),
  };
}

/**
 * The v0 adapter reads the seeded SQLite catalog. It is deliberately the only
 * place the comparison engine touches catalog persistence, so a future
 * Octopart/DigiKey/Mouser adapter can be dropped in behind the same interface.
 */
export const localCatalogAdapter: CatalogAdapter = {
  async listParts(filter) {
    const rows = await prisma.catalogPart.findMany({
      where: whereFromFilter(filter),
      orderBy: [{ category: "asc" }, { partNumber: "asc" }],
    });

    return rows.map(toDomain);
  },

  async getPart(id) {
    const row = await prisma.catalogPart.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  },

  async getPartsByIds(ids) {
    if (ids.length === 0) {
      return [];
    }

    const rows = await prisma.catalogPart.findMany({
      where: { id: { in: ids } },
    });
    const byId = new Map(rows.map((row) => [row.id, toDomain(row)]));

    return ids
      .map((id) => byId.get(id))
      .filter((part): part is CatalogPart => Boolean(part));
  },

  async listCategories() {
    return CATALOG_CATEGORIES.map((category) => ({ ...category }));
  },
};
