-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CatalogPart" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "partNumber" TEXT NOT NULL,
    "manufacturer" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "package" TEXT NOT NULL,
    "datasheetUrl" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "sourceRetrievedAt" DATETIME NOT NULL,
    "priceUsd" REAL,
    "specsJson" TEXT NOT NULL,
    "tags" TEXT NOT NULL,
    "origin" TEXT NOT NULL DEFAULT 'seeded'
);
INSERT INTO "new_CatalogPart" ("category", "datasheetUrl", "description", "id", "manufacturer", "package", "partNumber", "priceUsd", "sourceRetrievedAt", "sourceUrl", "specsJson", "tags") SELECT "category", "datasheetUrl", "description", "id", "manufacturer", "package", "partNumber", "priceUsd", "sourceRetrievedAt", "sourceUrl", "specsJson", "tags" FROM "CatalogPart";
DROP TABLE "CatalogPart";
ALTER TABLE "new_CatalogPart" RENAME TO "CatalogPart";
CREATE UNIQUE INDEX "CatalogPart_partNumber_key" ON "CatalogPart"("partNumber");
CREATE INDEX "CatalogPart_category_idx" ON "CatalogPart"("category");
CREATE INDEX "CatalogPart_manufacturer_idx" ON "CatalogPart"("manufacturer");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
