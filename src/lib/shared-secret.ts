import { createHmac, timingSafeEqual } from "node:crypto";

// Plain Node crypto (no Next.js-specific imports) so this can be imported
// both by the site (Next.js API routes) and by server/src/index.ts (the
// separate multiplayer process, which imports site modules by relative
// path -- see server/README.md). Used to (a) let a signed-in browser prove
// its identity to the multiplayer server via a short-lived token, and (b)
// let the multiplayer server authenticate score submissions back to the
// site -- both directions share the same HMAC secret.

function toBase64Url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function fromBase64Url(input: string): Buffer {
  return Buffer.from(input, "base64url");
}

/** Signs `payload` (plus an expiry) into a compact, URL-safe token. */
export function signPayload(payload: Record<string, unknown>, secret: string, ttlSeconds: number): string {
  const body = toBase64Url(JSON.stringify({ ...payload, exp: Date.now() + ttlSeconds * 1000 }));
  const signature = toBase64Url(createHmac("sha256", secret).update(body).digest());
  return `${body}.${signature}`;
}

/** Verifies a token from signPayload, returning its payload or null if invalid/expired/tampered. */
export function verifyPayload<T extends Record<string, unknown>>(token: string, secret: string): T | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, signature] = parts;

  const expected = createHmac("sha256", secret).update(body).digest();
  let actual: Buffer;
  try {
    actual = fromBase64Url(signature);
  } catch {
    return null;
  }
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  try {
    const parsed = JSON.parse(fromBase64Url(body).toString("utf8"));
    if (typeof parsed !== "object" || parsed === null) return null;
    if (typeof parsed.exp !== "number" || parsed.exp < Date.now()) return null;
    return parsed as T;
  } catch {
    return null;
  }
}
