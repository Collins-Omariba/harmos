import { randomUUID } from "node:crypto";

import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/db";

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export type CreateUserResult =
  | { ok: true; user: { id: string; email: string } }
  | { ok: false; message: string };

export async function createUser(
  email: string,
  password: string,
): Promise<CreateUserResult> {
  const normalized = normalizeEmail(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return { ok: false, message: "Enter a valid email address." };
  }
  if (password.length < 8) {
    return { ok: false, message: "Password must be at least 8 characters." };
  }

  const existing = await prisma.user.findUnique({
    where: { email: normalized },
    select: { id: true },
  });
  if (existing) {
    return { ok: false, message: "That email already has an account — log in instead." };
  }

  try {
    const user = await prisma.user.create({
      data: {
        id: `user-${randomUUID()}`,
        email: normalized,
        passwordHash: await hashPassword(password),
      },
      select: { id: true, email: true },
    });
    return { ok: true, user };
  } catch {
    return { ok: false, message: "Could not create the account — try again." };
  }
}

export type VerifyCredentialsResult =
  | { ok: true; user: { id: string; email: string } }
  | { ok: false; message: string };

/** Same message for unknown email and wrong password (no account probing). */
export async function verifyCredentials(
  email: string,
  password: string,
): Promise<VerifyCredentialsResult> {
  const user = await prisma.user.findUnique({
    where: { email: normalizeEmail(email) },
    select: { id: true, email: true, passwordHash: true },
  });
  if (!user) {
    return { ok: false, message: "Incorrect email or password." };
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return { ok: false, message: "Incorrect email or password." };
  }
  return { ok: true, user: { id: user.id, email: user.email } };
}

export async function countUsers(): Promise<number> {
  return prisma.user.count();
}

export async function getUserById(
  id: string,
): Promise<{ id: string; email: string } | null> {
  return prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true },
  });
}
