"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  createSessionToken,
  isAuthEnabled,
  passwordsMatch,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
} from "@/lib/auth/session";

export type AuthActionState = {
  ok: boolean;
  message: string;
} | null;

function workspacePassword(): string | null {
  const password = process.env.HARMOS_WORKSPACE_PASSWORD;
  return password && password.length >= 8 ? password : null;
}

const loginSchema = z.object({
  password: z.string().min(1, "Enter the workspace password."),
});

export async function loginAction(
  _previous: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  if (!isAuthEnabled()) {
    return { ok: false, message: "Authentication is not enabled." };
  }

  const password = workspacePassword();
  if (!password) {
    return {
      ok: false,
      message: "Set HARMOS_WORKSPACE_PASSWORD to at least 8 characters.",
    };
  }

  const parsed = loginSchema.safeParse({ password: formData.get("password") });
  if (!parsed.success || !passwordsMatch(parsed.data.password, password)) {
    return { ok: false, message: "Incorrect workspace password." };
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, createSessionToken(password), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

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
