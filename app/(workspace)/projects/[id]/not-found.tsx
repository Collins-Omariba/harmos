import Link from "next/link";
import { FolderX } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";

export default function ProjectNotFound() {
  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-16 md:px-8">
      <EmptyState
        icon={FolderX}
        title="Project not found"
        description="This project id is not in the local SQLite workspace. Seed the demo data or return to the project index."
        action={
          <Button asChild variant="outline">
            <Link href="/">Back to projects</Link>
          </Button>
        }
      />
    </div>
  );
}
