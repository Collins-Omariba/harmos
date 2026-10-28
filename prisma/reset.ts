import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Destructive demo reset: wipes all projects and catalog rows, then re-seeds.
 * Guarded by HARMOS_ALLOW_RESET so it can never run by accident; `pnpm seed`
 * itself is idempotent and never deletes user data.
 *
 * Usage: pnpm db:reset
 */
async function main() {
  if (process.env.HARMOS_ALLOW_RESET !== "1") {
    console.error(
      "Refusing to reset without HARMOS_ALLOW_RESET=1. Use `pnpm db:reset`.",
    );
    process.exit(1);
  }

  await prisma.project.deleteMany();
  await prisma.catalogPart.deleteMany();
  await prisma.$disconnect();

  await import("./seed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
