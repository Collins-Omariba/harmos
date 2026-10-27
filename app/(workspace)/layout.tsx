import { AppShell } from "@/components/app-shell";
import { listProjectSummaries } from "@/lib/projects";

export const dynamic = "force-dynamic";

export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const projects = await listProjectSummaries();

  return (
    <AppShell
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
