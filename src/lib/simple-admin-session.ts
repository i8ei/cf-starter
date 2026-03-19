import { bytesToHex } from "./crypto";

/** Constant-time string comparison to prevent timing attacks. */
export function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

async function hmacSign(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(message),
  );
  return bytesToHex(new Uint8Array(sig));
}

export async function createAdminSessionToken(secret: string): Promise<string> {
  const ts = Date.now().toString();
  const sig = await hmacSign(ts, secret);
  return `${ts}.${sig}`;
}

export async function verifyAdminSessionToken(
  token: string,
  secret: string
): Promise<boolean> {
  const dotIndex = token.indexOf(".");
  if (dotIndex === -1) return false;

  const ts = token.slice(0, dotIndex);
  const sig = token.slice(dotIndex + 1);

  const timestamp = Number.parseInt(ts, 10);
  if (!Number.isFinite(timestamp)) return false;
  if (Date.now() - timestamp > SESSION_TTL_MS) return false;

  const expected = await hmacSign(ts, secret);

  // Constant-time comparison
  if (sig.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) {
    diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}
