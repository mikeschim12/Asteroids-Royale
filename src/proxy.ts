import { NextRequest, NextResponse } from "next/server";

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
