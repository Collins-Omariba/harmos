-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ComparisonConstraint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "operator" TEXT NOT NULL,
    "valueJson" TEXT NOT NULL,
    "unit" TEXT,
    "kind" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "appliesToJson" TEXT NOT NULL DEFAULT '[]',
    CONSTRAINT "ComparisonConstraint_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ComparisonConstraint" ("id", "kind", "label", "metric", "operator", "position", "projectId", "unit", "valueJson") SELECT "id", "kind", "label", "metric", "operator", "position", "projectId", "unit", "valueJson" FROM "ComparisonConstraint";
DROP TABLE "ComparisonConstraint";
ALTER TABLE "new_ComparisonConstraint" RENAME TO "ComparisonConstraint";
CREATE INDEX "ComparisonConstraint_projectId_idx" ON "ComparisonConstraint"("projectId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
