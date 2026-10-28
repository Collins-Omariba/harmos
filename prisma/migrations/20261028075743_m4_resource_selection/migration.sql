-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Resource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "retrievedAt" DATETIME NOT NULL,
    "tags" TEXT NOT NULL,
    "selected" BOOLEAN NOT NULL DEFAULT false,
    "selectionNote" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "Resource_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Resource" ("id", "kind", "projectId", "retrievedAt", "summary", "tags", "title", "url") SELECT "id", "kind", "projectId", "retrievedAt", "summary", "tags", "title", "url" FROM "Resource";
DROP TABLE "Resource";
ALTER TABLE "new_Resource" RENAME TO "Resource";
CREATE INDEX "Resource_projectId_idx" ON "Resource"("projectId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
