-- CreateTable
CREATE TABLE "ComponentArtifactLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "artifactId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    CONSTRAINT "ComponentArtifactLink_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ComponentArtifactLink_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "Component" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ComponentArtifactLink_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "Artifact" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ComponentArtifactLink_projectId_idx" ON "ComponentArtifactLink"("projectId");

-- CreateIndex
CREATE INDEX "ComponentArtifactLink_componentId_idx" ON "ComponentArtifactLink"("componentId");

-- CreateIndex
CREATE INDEX "ComponentArtifactLink_artifactId_idx" ON "ComponentArtifactLink"("artifactId");

-- CreateIndex
CREATE UNIQUE INDEX "ComponentArtifactLink_componentId_artifactId_kind_key" ON "ComponentArtifactLink"("componentId", "artifactId", "kind");
