-- CreateTable
CREATE TABLE "CatalogProposal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "source" TEXT NOT NULL DEFAULT 'ai',
    "request" TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "CatalogProposal_status_idx" ON "CatalogProposal"("status");
