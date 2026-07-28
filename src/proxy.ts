import { NextRequest, NextResponse } from "next/server";

/**
 * Coarse per-IP rate limit, kept in memory. This only works because the
 * site runs as a single long-lived `next start` process on Railway (see
 * railway.toml) -- not a serverless/edge deploy where each invocation gets
 * a fresh module scope and this Map would never accumulate hits. If this
 * ever moves to a multi-instance or serverless deploy, this needs to move
 * to a shared store (Redis/Upstash) to keep working.
 *
 * Limits are deliberately generous (this is a canvas game polling nothing
 * over HTTP after load, not a SPA with chatty API calls) -- the goal is
 * blunting a scripted flood from driving up Railway's usage-based billing,
 * not shaping legitimate traffic.
 */
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 300;
// Random eviction beats an LRU here -- this only needs to stop *unbounded*
// growth from an attacker cycling through IPs/spoofed X-Forwarded-For
// values, not optimize which entries survive.
const RATE_LIMIT_MAX_TRACKED_IPS = 5000;
const rateLimitHits = new Map<string, { count: number; resetAt: number }>();

function clientIp(request: NextRequest): string {
  // Railway's edge sets this; the leftmost value is the original client.
  const forwardedFor = request.headers.get("x-forwarded-for");
  return forwardedFor?.split(",")[0]?.trim() || "unknown";
}

function isRateLimited(request: NextRequest): boolean {
  const ip = clientIp(request);
  const now = Date.now();
  const entry = rateLimitHits.get(ip);

  if (!entry || now > entry.resetAt) {
    if (rateLimitHits.size >= RATE_LIMIT_MAX_TRACKED_IPS) rateLimitHits.clear();
    rateLimitHits.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  entry.count += 1;
  return entry.count > RATE_LIMIT_MAX_REQUESTS;
}

/**
 * Sets a strict, per-request Content-Security-Policy (plus a few other
 * standard hardening headers) on every response. The nonce is generated
 * fresh per request and passed through via the `x-nonce` request header;
 * Next.js automatically applies it to the inline scripts it injects for
 * hydration, so we get a real script-src allowlist instead of resorting
 * to 'unsafe-inline'. See:
 * https://nextjs.org/docs/app/building-your-application/configuring/content-security-policy
 */
function multiplayerConnectSrc(): string {
  const url = process.env.NEXT_PUBLIC_MULTIPLAYER_URL;
  if (!url) return "ws://localhost:8080";
  try {
    return new URL(url).origin.replace(/^http/, "ws");
  } catch {
    return "ws: wss:";
  }
}

export function proxy(request: NextRequest) {
  if (isRateLimited(request)) {
    return new NextResponse("Too many requests", {
      status: 429,
      headers: { "Retry-After": String(RATE_LIMIT_WINDOW_MS / 1000) },
    });
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");

  const csp = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic';
    style-src 'self' 'unsafe-inline';
    img-src 'self' data: https://lh3.googleusercontent.com;
    font-src 'self' data:;
    connect-src 'self' https://accounts.google.com ${multiplayerConnectSrc()};
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    upgrade-insecure-requests;
  `
    .replace(/\s{2,}/g, " ")
    .trim();

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.headers.set("X-Frame-Options", "DENY");
  return response;
}

export const config = {
  matcher: [
    // Skip Next's static assets and image optimizer -- there's nothing
    // page-like to protect there, and running this on every asset
    // request would add pointless overhead.
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
