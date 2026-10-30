import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/login-form";
import { Wordmark } from "@/components/wordmark";
import {
  isAuthEnabled,
  SESSION_COOKIE,
  verifySessionToken,
} from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (!isAuthEnabled()) {
    redirect("/");
  }

  const cookieStore = await cookies();
  if (
    verifySessionToken(
      cookieStore.get(SESSION_COOKIE)?.value,
      process.env.HARMOS_WORKSPACE_PASSWORD,
    )
  ) {
    redirect("/");
  }

  return (
    <main className="schematic-grid flex min-h-dvh items-center justify-center px-5 py-10">
      <div className="flex w-full max-w-sm flex-col items-center">
        <Wordmark />
        <div className="mt-8 w-full">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
