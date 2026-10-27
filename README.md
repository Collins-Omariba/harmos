# Harmos

Harmos is an open-source, self-hostable, AI-assisted engineering workspace for
hardware makers. It takes a project from a rough idea — "an ESP32 water-tank
monitor that runs three months on battery" — to a researched, documented,
reproducible build. Requirements, sources, component comparisons, datasheets,
hardware files, firmware versions, BOMs, design decisions, and validation live
in one connected project graph. The project is the unit of work; every part,
artifact, and decision belongs to it.

## What Harmos is / is not

**Is**

- **Project-centric.** Every requirement, resource, component, artifact, edge,
  decision, and test hangs off a project.
- **Deterministic where it matters.** Constraint checks, dependency ripples, BOM
  totals, and version resolution are computed in code, not guessed by a model.
- **Self-hostable.** Next.js, Prisma, and a single-file SQLite database. One
  `docker compose up` brings the workspace online.
- **Open source.** MIT licensed, no account, no hosted service required.

**Is not**

- A chatbot.
- A distributor frontend.
- A CAD tool.
- A BOM-only app.

## How to run

Prerequisites: Node.js 20+, pnpm 9+, and Docker for the container path.

```bash
cp .env.example .env
pnpm install            # postinstall runs prisma generate
pnpm prisma migrate dev # creates prisma/data/harmos.db
pnpm seed               # one fictional demo project
pnpm dev                # http://localhost:3000
```

The local SQLite file is `prisma/data/harmos.db` because Prisma resolves
`file:./data/harmos.db` relative to `prisma/schema.prisma`. The Docker image
uses the absolute path `/data/harmos.db`.

Quality gates:

```bash
pnpm tsc --noEmit
pnpm lint
```

Docker path:

```bash
docker compose up --build
# open http://localhost:3000
```

The image builds the app, applies migrations, and seeds the demo database. On
first start the entrypoint copies that seeded SQLite file into the `harmos-data`
volume at `/data/harmos.db`. The AI cache is persisted in the separate
`harmos-cache` volume mounted at `/data/.cache`. To reset:

```bash
docker compose down -v
```

Configuration lives in `.env`:

| Variable          | Default                  | Purpose                                   |
| ----------------- | ------------------------ | ----------------------------------------- |
| `DATABASE_URL`    | `file:./data/harmos.db`  | Prisma SQLite location.                   |
| `OPENAI_BASE_URL` | `https://api.meta.ai/v1` | OpenAI-compatible base URL.               |
| `OPENAI_API_KEY`  | `your_key_here`          | Provider key. Not used by v0.             |
| `HARMOS_AI_MODEL` | `muse-spark-1.3`         | Model id sent by the AI client.           |
| `HARMOS_CACHE_DIR`| `./.cache`               | AI disk cache root.                       |
| `HARMOS_DEMO_MODE`| `0`                      | Replay cached AI responses when set to 1. |



## Origin of the name

Harmos (ἁρμός) is Greek for "joint, fitting" — the thing that makes separate
parts load-bearing together.
