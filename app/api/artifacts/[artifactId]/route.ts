import { cookies } from "next/headers";

import { readArtifactFile } from "@/lib/artifacts/storage";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";
import { getUserById, requireProjectAccess } from "@/lib/auth/users";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ artifactId: string }> },
) {
  const cookieStore = await cookies();
  const sessionUserId = verifySessionToken(
    cookieStore.get(SESSION_COOKIE)?.value,
  );
  const user = sessionUserId ? await getUserById(sessionUserId) : null;
  if (!user) {
    return new Response("Login required", { status: 401 });
  }

  const { artifactId } = await context.params;
  const artifact = await prisma.artifact.findUnique({
    where: { id: artifactId },
  });

  if (!artifact?.filePath) {
    return new Response("Artifact file not found", { status: 404 });
  }

  if (!(await requireProjectAccess(user.id, artifact.projectId))) {
    return new Response("Artifact file not found", { status: 404 });
  }

  try {
    const bytes = await readArtifactFile(artifact.filePath);
    return new Response(new Uint8Array(bytes), {
      headers: {
        "content-type": artifact.mimeType || "application/octet-stream",
        "content-disposition": `attachment; filename="${artifact.fileName ?? "artifact"}"`,
        "content-length": String(bytes.length),
      },
    });
  } catch {
    return new Response("Artifact file is missing from storage", {
      status: 404,
    });
  }
}
