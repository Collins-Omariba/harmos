import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Wordmark } from "@/components/wordmark";

export const metadata = {
  title: "Terms of Service — Harmos",
  description: "Terms of service for the Harmos engineering workspace.",
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

export default function TermsPage() {
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
          Legal / terms of service
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-foreground">
          Terms of Service
        </h1>
        <p className="numeric mt-1.5 text-xs text-muted-foreground">
          Last updated {UPDATED}
        </p>

        <Section title="1. What Harmos is">
          <p>
            Harmos is a self-hosted engineering workspace: project tracking,
            component comparison, a parts catalog, and artifact storage. You
            (or whoever operates your instance) run it on your own machine or
            server; there is no hosted Harmos service and no Harmos account
            that works across instances.
          </p>
        </Section>

        <Section title="2. Your account">
          <p>
            You log in with an email address and password. The password is
            stored as a salted scrypt hash — never plaintext — but you are
            still responsible for keeping your credentials secret and for
            anything done under your account.
          </p>
          <p>
            Signup is open on an instance by design: anyone who can reach your
            instance&apos;s address can create an account. Only expose Harmos
            to a network you trust, or put your own access controls in front
            of it.
          </p>
        </Section>

        <Section title="3. Your data">
          <p>
            Everything you put into Harmos — projects, requirements, parts,
            decisions, uploaded files — is stored on the machine running your
            instance, as described in the{" "}
            <Link href="/privacy" className="text-primary underline-offset-4 hover:underline">
              Privacy Policy
            </Link>
            . You can export your work at any time from the workspace backup
            feature.
          </p>
        </Section>

        <Section title="4. Acceptable use">
          <p>When you use Harmos, you agree not to:</p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              Abuse third-party services through it — including bulk-scraping
              distributor APIs. Catalog imports from LCSC are subject to the{" "}
              <a
                href="https://www.lcsc.com/docs/index.html"
                target="_blank"
                rel="noreferrer"
                className="text-primary underline-offset-4 hover:underline"
              >
                LCSC API terms of use
              </a>
              .
            </li>
            <li>
              Use AI-assisted features to generate harmful, unlawful, or
              infringing content, or to misrepresent AI-generated text as
              reviewed engineering data.
            </li>
            <li>
              Attempt to disrupt the instance or access other users&apos;
              sessions.
            </li>
          </ul>
        </Section>

        <Section title="5. AI features">
          <p>
            Explanations, proposals, and assistant answers are produced by an
            AI model and can be wrong. Comparison scores are computed
            deterministically; treat everything else as a draft until a human
            confirms it — the app enforces human approval before AI-suggested
            rows enter the catalog for exactly this reason.
          </p>
        </Section>

        <Section title="6. Availability and warranty">
          <p>
            Harmos is provided as-is, without warranty of any kind. The
            operator of your instance (which may be you) is responsible for
            backups, updates, and keeping the machine running.
          </p>
        </Section>

        <Section title="7. Changes">
          <p>
            These terms may change; the date above always shows the latest
            revision. Continued use of your instance after a change counts as
            acceptance.
          </p>
        </Section>
      </div>
    </main>
  );
}
