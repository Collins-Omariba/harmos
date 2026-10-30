import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { SignupForm } from "@/components/signup-form";
import { Wordmark } from "@/components/wordmark";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";
import { countUsers, getUserById } from "@/lib/auth/users";

export const dynamic = "force-dynamic";

export default async function SignupPage() {
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
          <SignupForm firstAccount={firstAccount} />
        </div>
      </div>
    </main>
  );
}
