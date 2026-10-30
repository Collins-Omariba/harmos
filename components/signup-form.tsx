"use client";

import Link from "next/link";
import { useActionState } from "react";
import { UserPlus } from "lucide-react";

import { signupAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function SignupForm({ firstAccount }: { firstAccount: boolean }) {
  const [state, formAction, pending] = useActionState(signupAction, null);

  return (
    <Card className="w-full max-w-sm border border-border bg-card/85 py-0 shadow-none ring-0">
      <CardContent className="p-6">
        <div className="flex size-11 items-center justify-center rounded-md border border-border bg-muted/50">
          <UserPlus className="size-5 text-primary" />
        </div>
        <h1 className="mt-5 text-xl font-semibold text-foreground">
          {firstAccount ? "Create the first account" : "Create an account"}
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          {firstAccount
            ? "No accounts exist yet — this one becomes the workspace owner."
            : "Your password is stored as a salted scrypt hash, never plaintext."}
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
              Password (8+ characters)
            </span>
            <input
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            />
          </label>

          {state && !state.ok ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {state.message}
            </p>
          ) : null}

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Creating..." : "Create account"}
          </Button>
        </form>

        <p className="mt-4 text-center text-xs leading-relaxed text-muted-foreground">
          By creating an account you agree to the{" "}
          <Link href="/terms" className="text-primary underline-offset-4 hover:underline">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="text-primary underline-offset-4 hover:underline">
            Privacy Policy
          </Link>
          . Already have one?{" "}
          <Link href="/login" className="text-primary underline-offset-4 hover:underline">
            Log in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
