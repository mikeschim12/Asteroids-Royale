import { prisma } from "@/lib/prisma";

export const metadata = {
  title: "Leaderboard — Royale.Rocks",
};

// Server-rendered on every request -- leaderboard changes as matches
// finish, and this page sees little enough traffic that caching isn't
// worth the staleness.
export const dynamic = "force-dynamic";

interface LeaderboardRow {
  userId: string;
  name: string;
  score: number;
  createdAt: Date;
}

async function getTopScores(): Promise<LeaderboardRow[]> {
  if (!process.env.DATABASE_URL) return [];
  // Each account's single best run, ranked -- not every match they've
  // played, which would let one prolific player bury the board.
  return prisma.$queryRaw<LeaderboardRow[]>`
    SELECT * FROM (
      SELECT DISTINCT ON ("userId") "userId", name, score, "createdAt"
      FROM "Score"
      ORDER BY "userId", score DESC
    ) best
    ORDER BY score DESC
    LIMIT 50
  `;
}

export default async function LeaderboardPage() {
  const rows = await getTopScores();

  return (
    <div className="flex-1 px-6 py-16">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-center font-mono text-3xl tracking-tight text-accent">
          LEADERBOARD
        </h1>
        <p className="mt-3 text-center text-sm text-foreground/50">
          Best scores from online PvP matches, sign in at{" "}
          <span className="text-accent">/play</span> to appear here.
        </p>

        {rows.length === 0 ? (
          <p className="mt-12 text-center text-foreground/40">
            No scores yet — be the first.
          </p>
        ) : (
          <ol className="mt-10 divide-y divide-accent/15 border-y border-accent/15">
            {rows.map((row, i) => (
              <li
                key={row.userId}
                className="flex items-center gap-4 px-2 py-3 text-sm"
              >
                <span className="w-8 shrink-0 text-right font-mono text-foreground/40">
                  {i + 1}
                </span>
                <span className="flex-1 truncate text-foreground/80">
                  {row.name}
                </span>
                <span className="font-mono text-accent">{row.score}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
