import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import {
  isAuthEnabled,
  SESSION_COOKIE,
  verifySessionToken,
} from "@/lib/auth/session";
import { listProjectSummaries } from "@/lib/projects";

export const dynamic = "force-dynamic";

export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const authEnabled = isAuthEnabled();
  if (authEnabled) {
    const cookieStore = await cookies();
    if (
      !verifySessionToken(
        cookieStore.get(SESSION_COOKIE)?.value,
        process.env.HARMOS_WORKSPACE_PASSWORD,
      )
    ) {
      redirect("/login");
    }
  }

  const projects = await listProjectSummaries();

  return (
    <AppShell
      authEnabled={authEnabled}
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
