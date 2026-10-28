import { readFile } from "node:fs/promises";

import { PrismaClient } from "@prisma/client";

import { parseCatalogCsv } from "../lib/catalog/csv";

const prisma = new PrismaClient();

/**
 * Import catalog rows from a CSV file (see lib/catalog/csv.ts for columns).
 * Upserts on id so re-imports update instead of duplicating.
 *
 * Usage: pnpm catalog:import -- ./parts.csv
 */
async function main() {
  const args = process.argv.slice(2).filter((arg) => arg !== "--");
  const file = args[0];

  if (!file) {
    console.error("Usage: pnpm catalog:import -- <file.csv>");
    process.exit(1);
  }

  const text = await readFile(file, "utf8");
  const { parts, issues } = parseCatalogCsv(text);

  for (const issue of issues) {
    console.error(`line ${issue.line}: ${issue.message}`);
  }

  if (parts.length === 0) {
    console.error("No valid rows to import.");
    process.exit(1);
  }

  let created = 0;
  let updated = 0;

  for (const part of parts) {
    const existing = await prisma.catalogPart.findFirst({
      where: {
        OR: [{ id: part.id }, { partNumber: part.partNumber }],
      },
    });

    const data = {
      partNumber: part.partNumber,
      manufacturer: part.manufacturer,
      category: part.category,
      description: part.description,
      package: part.package,
      datasheetUrl: part.datasheetUrl,
      sourceUrl: part.sourceUrl,
      sourceRetrievedAt: new Date(part.sourceRetrievedAt),
      priceUsd: part.priceUsd,
      specsJson: JSON.stringify(part.specs),
      tags: part.tags.join(", "),
    };

    if (existing) {
      await prisma.catalogPart.update({ where: { id: existing.id }, data });
      updated += 1;
    } else {
      await prisma.catalogPart.create({ data: { id: part.id, ...data } });
      created += 1;
    }
  }

  console.log(
    `Imported ${parts.length} rows: ${created} created, ${updated} updated, ${issues.length} rejected.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
