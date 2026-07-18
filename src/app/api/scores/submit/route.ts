import { prisma } from "@/lib/prisma";
import { verifyPayload } from "@/lib/shared-secret";

interface ScoreResult {
  userId: string;
  name: string;
  score: number;
}

interface ScoresPayload extends Record<string, unknown> {
  results: ScoreResult[];
}

const MAX_RESULTS_PER_SUBMIT = 32; // generous headroom over MAX_PLAYERS in server/src/index.ts
const MAX_SCORE = 1_000_000; // sanity ceiling, not a real balance limit

function isValidResult(r: unknown): r is ScoreResult {
  if (typeof r !== "object" || r === null) return false;
  const v = r as Record<string, unknown>;
  return (
    typeof v.userId === "string" &&
    v.userId.length > 0 &&
    v.userId.length <= 200 &&
    typeof v.name === "string" &&
    typeof v.score === "number" &&
    Number.isFinite(v.score) &&
    v.score >= 0 &&
    v.score <= MAX_SCORE
  );
}

/**
 * Records final match scores reported by the multiplayer server (a
 * separate process -- see server/README.md) once a round ends. Trusted
 * only via the shared-secret signature, since scores here are computed
 * authoritatively server-side from real gameplay, not self-reported by a
 * browser client.
 */
export async function POST(req: Request) {
  const secret = process.env.MULTIPLAYER_SHARED_SECRET;
  if (!secret) return new Response("not configured", { status: 503 });

  const token = await req.text();
  const payload = verifyPayload<ScoresPayload>(token, secret);
  if (!payload || !Array.isArray(payload.results)) {
    return new Response("invalid token", { status: 401 });
  }

  const rows = payload.results.filter(isValidResult).slice(0, MAX_RESULTS_PER_SUBMIT);
  if (rows.length === 0) return new Response("ok", { status: 200 });

  await prisma.score.createMany({
    data: rows.map((r) => ({
      userId: r.userId,
      name: r.name.trim().slice(0, 16) || "Player",
      score: Math.floor(r.score),
    })),
  });

  return new Response("ok", { status: 200 });
}
