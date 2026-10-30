import { AppShell } from "@/components/app-shell";
import { requireSessionUser } from "@/lib/auth/users";
import { listProjectSummaries } from "@/lib/projects";

export const dynamic = "force-dynamic";

export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireSessionUser();
  const projects = await listProjectSummaries(user.id);

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
