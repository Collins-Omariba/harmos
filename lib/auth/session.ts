import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "harmos-session";

export function isAuthEnabled(): boolean {
  return process.env.HARMOS_AUTH_ENABLED === "1";
}
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

function sign(payload: string, password: string): string {
  return createHmac("sha256", password).update(payload).digest("base64url");
}

export function createSessionToken(
  password: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): string {
  const expires = nowSeconds + SESSION_MAX_AGE_SECONDS;
  return `${expires}.${sign(String(expires), password)}`;
}

export function verifySessionToken(
  token: string | undefined,
  password: string | undefined,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  if (!token || !password) return false;
  const [expiresRaw, signature] = token.split(".");
  const expires = Number(expiresRaw);
  if (!expiresRaw || !signature || !Number.isFinite(expires)) return false;
  if (expires < nowSeconds) return false;

  const expected = sign(String(expires), password);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function passwordsMatch(candidate: string, expected: string): boolean {
  const a = createHmac("sha256", "harmos-password-compare")
    .update(candidate)
    .digest();
  const b = createHmac("sha256", "harmos-password-compare")
    .update(expected)
    .digest();
  return timingSafeEqual(a, b);
}
