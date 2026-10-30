import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";
import { getUserById } from "@/lib/auth/users";
import { listProjectSummaries } from "@/lib/projects";

export const dynamic = "force-dynamic";

export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const sessionUserId = verifySessionToken(
    cookieStore.get(SESSION_COOKIE)?.value,
  );
  const user = sessionUserId ? await getUserById(sessionUserId) : null;
  if (!user) {
    redirect("/login");
  }

  const projects = await listProjectSummaries();

  return (
    <AppShell
      userEmail={user.email}
      projects={projects.map(({ id, name, status }) => ({
        id,
        name,
        status,
      }))}
    >
      {children}
    </AppShell>
  );
}
