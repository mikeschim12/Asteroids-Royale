import Link from "next/link";
import StarfieldBackground from "@/components/StarfieldBackground";

const features = [
  {
    title: "AI bots, 1 winner",
    description:
      "Drop into a free-for-all against bots that hunt ships and asteroids alike. Last one flying takes it.",
  },
  {
    title: "Shrinking safe zone",
    description:
      "The playable ring closes in over time — stall outside it and you'll bleed HP fast. Nowhere to hide forever.",
  },
  {
    title: "Procedural asteroid fields",
    description:
      "Jagged, irregular rocks split when shot and scatter unpredictably. Every match reads differently.",
  },
];

const controls = [
  { keys: "W / ↑", action: "Thrust" },
  { keys: "A D / ← →", action: "Rotate" },
  { keys: "Space", action: "Fire" },
];

export default function Home() {
  return (
    <div className="flex-1 flex flex-col">
      <section className="relative flex-1 flex flex-col items-center justify-center gap-8 px-6 py-32 text-center overflow-hidden">
        <StarfieldBackground />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(47,123,246,0.14),_transparent_60%)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background"
        />

        <p className="relative font-mono text-xs tracking-[0.3em] text-accent">
          IN-BROWSER · NO INSTALL · FREE-FOR-ALL
        </p>
        <h1 className="relative text-5xl sm:text-7xl font-mono font-bold tracking-tight drop-shadow-[0_0_30px_rgba(47,123,246,0.2)]">
          ROYALE<span className="text-accent">.ROCKS</span>
        </h1>
        <p className="relative max-w-xl text-foreground/70 text-lg">
          The arcade classic, reborn as a battle royale. Dodge rocks, dodge
          ships, and outlast AI bots inside a shrinking arena.
        </p>
        <div className="relative flex flex-col sm:flex-row items-center gap-4">
          <Link
            href="/play"
            className="rounded-full bg-accent px-8 py-3 font-semibold text-white shadow-[0_0_30px_rgba(47,123,246,0.35)] hover:bg-accent/90 hover:shadow-[0_0_40px_rgba(47,123,246,0.5)] transition-all"
          >
            Play Now
          </Link>
          <Link
            href="/signin"
            className="rounded-full border border-black/10 bg-white px-8 py-3 font-medium text-foreground/80 hover:border-accent hover:text-accent transition-colors"
          >
            Sign in to save scores
          </Link>
        </div>

        <div className="relative flex items-center gap-2 text-xs text-foreground/40 font-mono">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Servers online
        </div>
      </section>

      <section className="border-t border-black/10 bg-white px-6 py-20">
        <div className="mx-auto grid max-w-5xl gap-8 sm:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-2xl border border-black/10 bg-accent-soft p-6 transition-colors hover:border-accent/40"
            >
              <h2 className="font-mono text-sm tracking-wide text-accent">
                {feature.title}
              </h2>
              <p className="mt-3 text-sm text-foreground/60">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-black/10 px-6 py-16">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="font-mono text-sm tracking-[0.2em] text-foreground/40">
            HOW TO PLAY
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {controls.map((c) => (
              <div
                key={c.action}
                className="rounded-xl border border-black/10 bg-white px-4 py-4"
              >
                <div className="font-mono text-accent">{c.keys}</div>
                <div className="mt-1 text-sm text-foreground/60">{c.action}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-black/10 bg-white px-6 py-20 text-center">
        <h2 className="text-2xl sm:text-3xl font-mono tracking-tight">
          Ready to be the <span className="text-accent">last one standing</span>?
        </h2>
        <Link
          href="/play"
          className="mt-8 inline-block rounded-full bg-accent px-8 py-3 font-semibold text-white hover:bg-accent/90 transition-colors"
        >
          Play Now
        </Link>
      </section>
    </div>
  );
}
