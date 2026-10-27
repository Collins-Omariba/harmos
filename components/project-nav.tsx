"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import type { ProjectNavItem } from "@/lib/projects";

export function ProjectNavList({
  projects,
  onNavigate,
}: {
  projects: ProjectNavItem[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav className="space-y-0.5 p-2" aria-label="Projects">
      {projects.map((project) => {
        const href = `/projects/${project.id}`;
        const active = pathname === href;

        return (
          <Link
            key={project.id}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground",
              active && "bg-sidebar-accent text-foreground",
            )}
          >
            <span
              className={cn(
                "size-1.5 shrink-0 rounded-full bg-muted-foreground/60",
                project.status === "active" && "bg-primary",
                active && "bg-primary",
              )}
            />
            <span className="min-w-0 flex-1 truncate">{project.name}</span>
            <ChevronRight
              className={cn(
                "size-3.5 shrink-0 text-muted-foreground/0 transition-colors",
                active && "text-muted-foreground",
                "group-hover:text-muted-foreground",
              )}
            />
          </Link>
        );
      })}
      {projects.length === 0 ? (
        <p className="px-2.5 py-3 text-xs leading-relaxed text-muted-foreground">
          No projects yet. Seed the demo data or create a project.
        </p>
      ) : null}
    </nav>
  );
}
