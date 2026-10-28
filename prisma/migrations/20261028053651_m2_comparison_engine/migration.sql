-- CreateTable
CREATE TABLE "CatalogPart" (
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
    "tags" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "ComparisonConstraint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "operator" TEXT NOT NULL,
    "valueJson" TEXT NOT NULL,
    "unit" TEXT,
    "kind" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "ComparisonConstraint_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ComparisonRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "explanationStatus" TEXT NOT NULL,
    "constraintsJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ComparisonRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ComparisonCandidate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "runId" TEXT,
    "catalogPartId" TEXT,
    "partNumber" TEXT NOT NULL,
    "manufacturer" TEXT NOT NULL,
    "dataJson" TEXT NOT NULL,
    "verdict" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "constraintResultsJson" TEXT NOT NULL DEFAULT '[]',
    CONSTRAINT "ComparisonCandidate_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ComparisonCandidate_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ComparisonRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ComparisonCandidate" ("dataJson", "id", "manufacturer", "partNumber", "projectId", "reason", "verdict") SELECT "dataJson", "id", "manufacturer", "partNumber", "projectId", "reason", "verdict" FROM "ComparisonCandidate";
DROP TABLE "ComparisonCandidate";
ALTER TABLE "new_ComparisonCandidate" RENAME TO "ComparisonCandidate";
CREATE INDEX "ComparisonCandidate_projectId_idx" ON "ComparisonCandidate"("projectId");
CREATE INDEX "ComparisonCandidate_runId_idx" ON "ComparisonCandidate"("runId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "CatalogPart_partNumber_key" ON "CatalogPart"("partNumber");

-- CreateIndex
CREATE INDEX "CatalogPart_category_idx" ON "CatalogPart"("category");

-- CreateIndex
CREATE INDEX "CatalogPart_manufacturer_idx" ON "CatalogPart"("manufacturer");

-- CreateIndex
CREATE INDEX "ComparisonConstraint_projectId_idx" ON "ComparisonConstraint"("projectId");

-- CreateIndex
CREATE INDEX "ComparisonRun_projectId_idx" ON "ComparisonRun"("projectId");
