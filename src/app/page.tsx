import Link from "next/link";

export default function Home() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-8 px-6 py-24 text-center">
      <h1 className="text-4xl sm:text-6xl font-mono tracking-tight">
        ASTEROIDS <span className="text-amber-400">ROYALE</span>
      </h1>
      <p className="max-w-xl text-white/60">
        The arcade classic, reborn as a battle royale. Dodge, blast, and
        outlast every other ship until you&apos;re the last one flying.
      </p>
      <Link
        href="/play"
        className="rounded-full bg-amber-400 px-8 py-3 font-medium text-black hover:bg-amber-300 transition-colors"
      >
        Play Now
      </Link>
    </div>
  );
}
