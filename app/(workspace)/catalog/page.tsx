import { CatalogManager } from "@/components/catalog-manager";
import { catalog } from "@/lib/catalog";
import { padCount } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function CatalogPage() {
  const parts = await catalog.listParts();

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-8 md:px-8 lg:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="numeric text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Library / catalog
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-foreground">
            Component catalog
          </h1>
          <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Real parts with sourced specs. Seeded rows ship with the app;
            imported and custom rows are yours — the seed fills gaps but never
            overwrites them.
          </p>
        </div>
        <span className="numeric text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          {padCount(parts.length)} parts
        </span>
      </div>

      <div className="mt-7">
        <CatalogManager parts={parts} />
      </div>
    </div>
  );
}
