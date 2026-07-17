import { auth } from "@/auth";
import { signPayload } from "@/lib/shared-secret";

// Short-lived (matches match length, not a long-term credential) so a
// leaked URL query param stops being useful quickly.
const TOKEN_TTL_SECONDS = 60 * 20;

/**
 * Mints a token proving to the multiplayer server (a separate process,
 * see server/README.md) which signed-in account is connecting, so it can
 * attribute a match's final score to that account. Returns { token: null }
 * whenever there's nothing to attribute to -- not signed in, or the
 * shared secret isn't configured -- so online play still works
 * unauthenticated, just without a recorded score.
 */
export async function POST() {
  const secret = process.env.MULTIPLAYER_SHARED_SECRET;
  const session = await auth();
  const userId = session?.user?.id;

  if (!secret || !userId) {
    return Response.json({ token: null });
  }

  const token = signPayload({ sub: userId, name: session.user?.name ?? "Player" }, secret, TOKEN_TTL_SECONDS);
  return Response.json({ token });
}
