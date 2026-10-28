-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Component" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "partNumber" TEXT NOT NULL,
    "manufacturer" TEXT NOT NULL,
    "package" TEXT NOT NULL,
    "datasheetUrl" TEXT,
    "notes" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPriceCents" INTEGER,
    CONSTRAINT "Component_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Component" ("datasheetUrl", "id", "manufacturer", "notes", "package", "partNumber", "projectId") SELECT "datasheetUrl", "id", "manufacturer", "notes", "package", "partNumber", "projectId" FROM "Component";
DROP TABLE "Component";
ALTER TABLE "new_Component" RENAME TO "Component";
CREATE INDEX "Component_projectId_idx" ON "Component"("projectId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
