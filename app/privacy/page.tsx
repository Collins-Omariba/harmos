import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Wordmark } from "@/components/wordmark";

export const metadata = {
  title: "Privacy Policy — Harmos",
  description: "Privacy policy for the Harmos engineering workspace.",
};

const UPDATED = "October 30, 2026";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-7">
      <h2 className="text-base font-medium text-foreground">{title}</h2>
      <div className="mt-2 space-y-2.5 text-sm leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <main className="schematic-grid min-h-dvh px-5 py-10">
      <div className="mx-auto w-full max-w-2xl">
        <div className="flex items-center justify-between">
          <Wordmark />
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            <ArrowLeft className="size-3.5" />
            Back to workspace
          </Link>
        </div>

        <p className="numeric mt-8 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          Legal / privacy policy
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-foreground">
          Privacy Policy
        </h1>
        <p className="numeric mt-1.5 text-xs text-muted-foreground">
          Last updated {UPDATED}
        </p>

        <Section title="1. The short version">
          <p>
            Harmos is self-hosted: your data lives in a database and file
            folder on the machine running your instance — not on our servers,
            because there are none. The only data that ever leaves the machine
            is what you explicitly send out: AI requests you trigger, and
            distributor lookups you trigger.
          </p>
        </Section>

        <Section title="2. What is stored">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <strong className="text-foreground">Account data:</strong> your
              email address and a salted scrypt hash of your password.
              Passwords are never stored in plaintext and never logged.
            </li>
            <li>
              <strong className="text-foreground">Your work:</strong>{" "}
              projects, requirements, constraints, components, artifacts,
              decisions, validation tests, research links, and comparison
              runs — everything you enter or upload, including artifact files
              (schematics, firmware, datasheets).
            </li>
            <li>
              <strong className="text-foreground">Session cookie:</strong> a
              signed, httpOnly cookie that keeps you logged in for 7 days.
              It carries no personal data beyond your account id.
            </li>
          </ul>
        </Section>

        <Section title="3. Where it is stored">
          <p>
            In a SQLite database (`harmos.db`) and an upload directory on the
            instance machine — the `/data` volume when running under Docker.
            Whoever operates the instance controls that machine; if
            that&apos;s you, your data never leaves hardware you own unless
            you send it out (see below).
          </p>
        </Section>

        <Section title="4. What leaves the machine">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <strong className="text-foreground">AI features:</strong> when
              you run an assistant answer, explanation, proposal, or research
              task, the relevant project text is sent to your configured AI
              provider (`AI_BASE_URL` / `AI_MODEL`). Nothing is sent when you
              don&apos;t use these features, and demo mode sends nothing at
              all.
            </li>
            <li>
              <strong className="text-foreground">Distributor imports:</strong>{" "}
              when you look up an LCSC product code, that code is sent to
              LCSC&apos;s API. See the{" "}
              <a
                href="https://www.lcsc.com/docs/index.html"
                target="_blank"
                rel="noreferrer"
                className="text-primary underline-offset-4 hover:underline"
              >
                LCSC API terms
              </a>
              .
            </li>
          </ul>
          <p>
            There is no analytics, no tracking, and no other third-party
            calls. Harmos makes no network requests on your behalf except the
            two cases above.
          </p>
        </Section>

        <Section title="5. Your rights: export and deletion">
          <p>
            Export everything at any time with the workspace backup feature
            (Projects page → Backup workspace), which downloads all projects
            plus the catalog as JSON.
          </p>
          <p>
            Logging out ends your session immediately. To erase an account,
            ask your instance operator to delete the user row; for complete
            erasure, delete the database file and the upload directory (the
            Docker `/data` volume). There is no remote copy to chase —
            deletion on the machine is deletion everywhere.
          </p>
        </Section>

        <Section title="6. Changes">
          <p>
            This policy may change; the date above always shows the latest
            revision. Material changes to what leaves the machine will be
            noted in the app changelog.
          </p>
        </Section>
      </div>
    </main>
  );
}
