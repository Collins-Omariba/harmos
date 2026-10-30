import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "harmos-session";
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

let ephemeralSecret: string | null = null;
let warnedAboutEphemeralSecret = false;

/**
 * Signing secret for session cookies. Set HARMOS_SESSION_SECRET to keep
 * sessions valid across restarts; otherwise a random per-boot secret is used
 * (everyone is logged out on restart) and a warning is logged once.
 */
export function getSessionSecret(): string {
  const configured = process.env.HARMOS_SESSION_SECRET?.trim();
  if (configured) return configured;

  if (!ephemeralSecret) {
    ephemeralSecret = randomBytes(32).toString("hex");
  }
  if (!warnedAboutEphemeralSecret) {
    warnedAboutEphemeralSecret = true;
    console.warn(
      "[auth] HARMOS_SESSION_SECRET is not set — using an ephemeral secret. " +
        "Sessions will not survive a restart; set the variable for stable logins.",
    );
  }
  return ephemeralSecret;
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createSessionToken(
  userId: string,
  secret: string = getSessionSecret(),
  nowSeconds = Math.floor(Date.now() / 1000),
): string {
  const expires = nowSeconds + SESSION_MAX_AGE_SECONDS;
  return `${userId}.${expires}.${sign(`${userId}.${expires}`, secret)}`;
}

/** Returns the user id for a valid, unexpired token, else null. */
export function verifySessionToken(
  token: string | undefined,
  secret: string = getSessionSecret(),
  nowSeconds = Math.floor(Date.now() / 1000),
): string | null {
  if (!token) return null;
  const separator = token.lastIndexOf(".");
  if (separator < 0) return null;
  const payload = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  const dot = payload.lastIndexOf(".");
  if (dot < 0) return null;

  const userId = payload.slice(0, dot);
  const expires = Number(payload.slice(dot + 1));
  if (!userId || !Number.isFinite(expires)) return null;
  if (expires < nowSeconds) return null;

  const expected = sign(payload, secret);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return userId;
}
