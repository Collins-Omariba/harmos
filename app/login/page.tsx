import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/login-form";
import { Wordmark } from "@/components/wordmark";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";
import { countUsers, getUserById } from "@/lib/auth/users";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const cookieStore = await cookies();
  const sessionUserId = verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
  if (sessionUserId && (await getUserById(sessionUserId))) {
    redirect("/");
  }

  const firstAccount = (await countUsers()) === 0;

  return (
    <main className="schematic-grid flex min-h-dvh items-center justify-center px-5 py-10">
      <div className="flex w-full max-w-sm flex-col items-center">
        <Wordmark />
        <div className="mt-8 w-full">
          <LoginForm />
        </div>
        {firstAccount ? (
          <p className="mt-4 max-w-sm text-center text-xs leading-relaxed text-muted-foreground">
            No accounts exist yet —{" "}
            <Link href="/signup" className="text-primary underline-offset-4 hover:underline">
              create the first one
            </Link>
            .
          </p>
        ) : null}
      </div>
    </main>
  );
}
