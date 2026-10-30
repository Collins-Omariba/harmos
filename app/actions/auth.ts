"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  createSessionToken,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
} from "@/lib/auth/session";
import { createUser, verifyCredentials } from "@/lib/auth/users";

export type AuthActionState = {
  ok: boolean;
  message: string;
} | null;

const authSchema = z.object({
  email: z.string().trim().min(1, "Enter your email address."),
  password: z.string().min(1, "Enter your password."),
});

async function startSession(userId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, createSessionToken(userId), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function signupAction(
  _previous: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = authSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the form." };
  }

  const created = await createUser(parsed.data.email, parsed.data.password);
  if (!created.ok) {
    return created;
  }

  await startSession(created.user.id);
  redirect("/");
}

export async function loginAction(
  _previous: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = authSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the form." };
  }

  const checked = await verifyCredentials(parsed.data.email, parsed.data.password);
  if (!checked.ok) {
    return checked;
  }

  await startSession(checked.user.id);
  redirect("/");
}

export async function logoutAction(formData: FormData): Promise<void> {
  void formData;
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  redirect("/login");
}
