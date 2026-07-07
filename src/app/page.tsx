import Link from "next/link";
import StarfieldBackground from "@/components/StarfieldBackground";
import OrbitRings from "@/components/OrbitRings";
import {
  BotIcon,
  PulseIcon,
  DebrisIcon,
  MoveIcon,
  StickIcon,
  CrosshairIcon,
  SparkleIcon,
  CrownIcon,
} from "@/components/icons";

const features = [
  {
    icon: BotIcon,
    title: "Dynamic AI & Single-Pilot Triumph",
    description: (
      <>
        Face <span className="text-accent">intelligent, hunting bots</span>{" "}
        that adapt and clear the field. Secure victory as the last human
        pilot.
      </>
    ),
  },
  {
    icon: PulseIcon,
    title: "Pulsating Arena Collapse",
    description:
      "A shrinking gravitational anomaly forces all pilots together. Survive outside or suffer rapid shield failure.",
  },
  {
    icon: DebrisIcon,
    title: "Reactive Space Debris",
    description:
      "Fragmenting rocks that split on impact, scattering in realistic vectors. Strategic movement is paramount.",
  },
];

const controls = [
  { icon: MoveIcon, label: "Precision movement", sub: "WASD / Arrows" },
  { icon: StickIcon, label: "Movement & Aiming Stick", sub: "Touch controls" },
  { icon: CrosshairIcon, label: "Aim and fire", sub: "Space / Fire button" },
];

export default function Home() {
  return (
    <div className="flex-1 flex flex-col">
      <section className="relative flex-1 flex flex-col items-center justify-center gap-8 px-6 py-32 text-center overflow-hidden">
        <StarfieldBackground />
        <OrbitRings />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(57,255,95,0.1),_transparent_60%)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background"
        />
        <SparkleIcon className="pointer-events-none absolute bottom-16 right-10 h-6 w-6 text-foreground/30 hidden sm:block" />

        <p className="relative font-mono text-xs tracking-[0.3em] text-accent">
          IN-BROWSER · NO INSTALL · FREE-FOR-ALL
        </p>
        <div className="relative inline-block">
          <CrownIcon className="absolute -top-4 -left-3 sm:-top-6 sm:-left-5 h-6 w-6 sm:h-9 sm:w-9 -rotate-[18deg] text-accent drop-shadow-[0_0_12px_rgba(57,255,95,0.8)]" />
          <h1 className="relative text-5xl sm:text-7xl font-mono font-bold tracking-tight text-accent drop-shadow-[0_0_20px_rgba(57,255,95,0.6)]">
            ROYALE<span className="text-foreground">.ROCKS</span>
          </h1>
        </div>
        <p className="relative max-w-xl text-foreground/70 text-lg">
          The definitive <span className="text-accent">space classic</span>,
          reborn as an <span className="text-accent">asteroid battle royale</span>.
          Evade debris, master movement, and eliminate all threats inside an
          intense, <span className="text-accent">shrinking arena</span>.
        </p>
        <div className="relative flex flex-col sm:flex-row items-center gap-4">
          <Link
            href="/play"
            className="rounded-md bg-accent px-8 py-3 font-semibold text-black shadow-[0_0_20px_rgba(57,255,95,0.45)] hover:bg-accent/90 hover:shadow-[0_0_30px_rgba(57,255,95,0.6)] transition-all"
          >
            Play Now
          </Link>
          <Link
            href="/signin"
            className="rounded-md border border-accent/40 px-8 py-3 font-medium text-foreground/80 hover:border-accent hover:text-accent transition-colors"
          >
            Sign in to save scores
          </Link>
        </div>

        <div className="relative flex items-center gap-2 text-xs text-foreground/40 font-mono">
          <span className="h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_6px_rgba(57,255,95,0.8)]" />
          Servers online
        </div>
      </section>

      <section className="border-t border-accent/20 bg-black px-6 py-20">
        <div className="mx-auto grid max-w-5xl gap-8 sm:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-md border border-accent/20 bg-accent-soft p-6 transition-colors hover:border-accent/60"
            >
              <feature.icon className="h-6 w-6 text-accent" />
              <h2 className="mt-3 font-mono text-sm tracking-wide text-accent">
                {feature.title}
              </h2>
              <p className="mt-3 text-sm text-foreground/60">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-accent/20 px-6 py-16">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="font-mono text-sm tracking-[0.2em] text-foreground/40">
            HOW TO PLAY
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {controls.map((c) => (
              <div
                key={c.label}
                className="flex flex-col items-center gap-2 rounded-md border border-accent/20 bg-accent-soft px-4 py-5"
              >
                <c.icon className="h-6 w-6 text-accent" />
                <div className="font-mono text-sm text-accent">{c.label}</div>
                <div className="text-xs text-foreground/50">{c.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-accent/20 bg-black px-6 py-20 text-center">
        <h2 className="text-2xl sm:text-3xl font-mono tracking-tight">
          Ready to be the <span className="text-accent">last one standing</span>?
        </h2>
        <Link
          href="/play"
          className="mt-8 inline-block rounded-md bg-accent px-8 py-3 font-semibold text-black shadow-[0_0_20px_rgba(57,255,95,0.4)] hover:bg-accent/90 transition-colors"
        >
          Play Now
        </Link>
      </section>
    </div>
  );
}
