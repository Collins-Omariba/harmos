"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";

import { NewProjectButton } from "@/components/new-project-button";
import { ProjectNavList, LibraryNav } from "@/components/project-nav";
import { logoutAction } from "@/app/actions/auth";
import { ThemeToggle } from "@/components/theme-toggle";
import { Wordmark } from "@/components/wordmark";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { ProjectNavItem } from "@/lib/projects";
import { padCount } from "@/lib/format";

function MobileNav({ projects }: { projects: ProjectNavItem[] }) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label="Open project navigation"
        >
          <Menu />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 border-border bg-sidebar p-0">
        <SheetHeader className="border-b border-border p-4">
          <SheetTitle>
            <Wordmark />
          </SheetTitle>
          <SheetDescription className="numeric text-[10px] uppercase tracking-[0.2em]">
            Project index
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <ProjectNavList
            projects={projects}
            onNavigate={() => setOpen(false)}
          />
          <LibraryNav onNavigate={() => setOpen(false)} />
        </div>
        <div className="border-t border-border p-3">
          <NewProjectButton className="w-full" />
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Sidebar({ projects }: { projects: ProjectNavItem[] }) {
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-sidebar md:flex">
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-border px-4">
        <span className="numeric text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Project index
        </span>
        <span className="numeric text-[10px] text-muted-foreground">
          {padCount(projects.length)}
        </span>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <ProjectNavList projects={projects} />
        <LibraryNav />
      </ScrollArea>
      <div className="shrink-0 border-t border-border p-3">
        <NewProjectButton className="w-full" />
      </div>
    </aside>
  );
}

export function AppShell({
  projects,
  children,
  authEnabled = false,
}: {
  projects: ProjectNavItem[];
  children: React.ReactNode;
  authEnabled?: boolean;
}) {
  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <header className="flex h-16 shrink-0 items-center gap-2 border-b-2 border-primary/70 bg-background px-3 md:px-5">
        <MobileNav projects={projects} />
        <Link
          href="/"
          className="shrink-0 rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          aria-label="Harmos home"
        >
          <Wordmark />
        </Link>
        <span className="mx-1 hidden h-5 w-px bg-primary/60 sm:block" />
        <span className="numeric hidden text-[10px] uppercase tracking-[0.2em] text-primary xl:inline">
          Engineering workspace
        </span>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          {authEnabled ? (
            <form action={logoutAction}>
              <Button type="submit" variant="ghost" size="sm">
                Log out
              </Button>
            </form>
          ) : null}
          <ThemeToggle />
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <Sidebar projects={projects} />
        <main className="schematic-grid min-w-0 flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
