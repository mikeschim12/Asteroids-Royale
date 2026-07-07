export const metadata = {
  title: "Privacy Policy — Royale.Rocks",
};

export default function PrivacyPage() {
  const updated = "July 7, 2026";

  return (
    <div className="flex-1 px-6 py-16">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-3xl font-mono tracking-tight">Privacy Policy</h1>
        <p className="mt-2 text-sm text-foreground/50">
          Last updated: {updated}
        </p>

        <div className="mt-10 space-y-8 text-sm leading-relaxed text-foreground/80">
          <section>
            <h2 className="font-mono text-base text-accent">
              What we collect
            </h2>
            <p className="mt-2">
              Royale.Rocks is playable without an account. If you choose to
              sign in with Google, we receive your name, email address, and
              profile picture from Google to identify your account &mdash; we
              never see or store your Google password.
            </p>
          </section>

          <section>
            <h2 className="font-mono text-base text-accent">Cookies</h2>
            <p className="mt-2">
              We use a small number of essential cookies to keep you signed
              in between visits. We don&apos;t use third-party advertising or
              tracking cookies.
            </p>
          </section>

          <section>
            <h2 className="font-mono text-base text-accent">
              How we use your data
            </h2>
            <p className="mt-2">
              Your account info is used only to support features like saved
              scores and leaderboards. We don&apos;t sell or share your data
              with third parties.
            </p>
          </section>

          <section>
            <h2 className="font-mono text-base text-accent">Data retention</h2>
            <p className="mt-2">
              We retain account data for as long as you have an account with
              us. You can request deletion of your data at any time.
            </p>
          </section>

          <section>
            <h2 className="font-mono text-base text-accent">Your rights</h2>
            <p className="mt-2">
              You can request access to, correction of, or deletion of your
              personal data at any time by contacting us (see below).
            </p>
          </section>

          <section>
            <h2 className="font-mono text-base text-accent">Contact</h2>
            <p className="mt-2">
              Questions about this policy or your data? Reach out via the
              contact information on our GitHub repository.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
