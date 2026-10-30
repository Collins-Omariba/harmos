"use client";

import Link from "next/link";
import { useActionState } from "react";
import { LockKeyhole } from "lucide-react";

import { loginAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, null);

  return (
    <Card className="w-full max-w-sm border border-border bg-card/85 py-0 shadow-none ring-0">
      <CardContent className="p-6">
        <div className="flex size-11 items-center justify-center rounded-md border border-border bg-muted/50">
          <LockKeyhole className="size-5 text-primary" />
        </div>
        <h1 className="mt-5 text-xl font-semibold text-foreground">
          Log in to Harmos
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          Your workspace, parts, and files live on this machine — log in to
          pick up where you left off.
        </p>

        <form action={formAction} className="mt-5 space-y-4">
          <label className="block space-y-1.5">
            <span className="numeric text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              Email
            </span>
            <input
              name="email"
              type="email"
              required
              autoFocus
              autoComplete="email"
              placeholder="you@example.com"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="numeric text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              Password
            </span>
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            />
          </label>

          {state && !state.ok ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {state.message}
            </p>
          ) : null}

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Checking..." : "Log in"}
          </Button>
        </form>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          No account yet?{" "}
          <Link href="/signup" className="text-primary underline-offset-4 hover:underline">
            Create one
          </Link>
        </p>
        <p className="numeric mt-2 text-center text-[10px] text-muted-foreground">
          <Link href="/terms" className="underline-offset-4 hover:underline">
            Terms
          </Link>
          {" · "}
          <Link href="/privacy" className="underline-offset-4 hover:underline">
            Privacy
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
