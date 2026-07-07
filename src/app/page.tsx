import Link from "next/link";

const features = [
  {
    title: "Shrinking safe zone",
    description:
      "Stay inside the ring or take steady damage — the arena closes in as the match goes on.",
  },
  {
    title: "Procedural asteroid fields",
    description:
      "Every wave of jagged, irregular asteroids splits and scatters differently. No two runs play the same.",
  },
  {
    title: "Score & survive",
    description:
      "Rack up points blasting rocks, manage your lives, and see how long you can last.",
  },
];

export default function Home() {
  return (
    <div className="flex-1 flex flex-col">
      <section className="relative flex-1 flex flex-col items-center justify-center gap-8 px-6 py-32 text-center overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(245,158,11,0.12),_transparent_60%)]"
        />
        <p className="relative font-mono text-xs tracking-[0.3em] text-amber-400/80">
          IN-BROWSER · NO INSTALL
        </p>
        <h1 className="relative text-4xl sm:text-6xl font-mono tracking-tight">
          ASTEROIDS <span className="text-amber-400">ROYALE</span>
        </h1>
        <p className="relative max-w-xl text-white/60 text-lg">
          The arcade classic, reborn as a battle royale. Dodge, blast, and
          outlast every other ship until you&apos;re the last one flying.
        </p>
        <div className="relative flex flex-col sm:flex-row items-center gap-4">
          <Link
            href="/play"
            className="rounded-full bg-amber-400 px-8 py-3 font-medium text-black hover:bg-amber-300 transition-colors"
          >
            Play Now
          </Link>
          <Link
            href="/signin"
            className="rounded-full border border-white/15 px-8 py-3 font-medium text-white/80 hover:border-amber-400 hover:text-amber-400 transition-colors"
          >
            Sign in to save scores
          </Link>
        </div>
      </section>

      <section className="border-t border-white/10 px-6 py-20">
        <div className="mx-auto grid max-w-5xl gap-8 sm:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-2xl border border-white/10 bg-white/[0.02] p-6"
            >
              <h2 className="font-mono text-sm tracking-wide text-amber-400">
                {feature.title}
              </h2>
              <p className="mt-3 text-sm text-white/60">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
