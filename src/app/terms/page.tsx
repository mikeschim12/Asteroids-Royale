export const metadata = {
  title: "Terms of Service — Royale.Rocks",
};

export default function TermsPage() {
  const updated = "July 7, 2026";

  return (
    <div className="flex-1 px-6 py-16">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-3xl font-mono tracking-tight">
          Terms of Service
        </h1>
        <p className="mt-2 text-sm text-foreground/50">
          Last updated: {updated}
        </p>

        <div className="mt-10 space-y-8 text-sm leading-relaxed text-foreground/80">
          <section>
            <h2 className="font-mono text-base text-accent">1. Acceptance of terms</h2>
            <p className="mt-2">
              By accessing or playing Royale.Rocks (&quot;the Game&quot;, &quot;the
              Service&quot;), you agree to these Terms of Service. If you do not
              agree, please don&apos;t use the Service.
            </p>
          </section>

          <section>
            <h2 className="font-mono text-base text-accent">2. The service</h2>
            <p className="mt-2">
              Royale.Rocks is a free, browser-based game provided as-is, for
              entertainment purposes. Features, gameplay balance, and
              availability may change at any time without notice.
            </p>
          </section>

          <section>
            <h2 className="font-mono text-base text-accent">3. Accounts</h2>
            <p className="mt-2">
              Signing in with Google is optional. If you sign in, we use your
              Google account only to identify you (name, email, profile
              picture) for features like saved scores and leaderboards. You
              can request removal of your account data at any time (see
              Contact below).
            </p>
          </section>

          <section>
            <h2 className="font-mono text-base text-accent">4. Acceptable use</h2>
            <p className="mt-2">
              Don&apos;t use the Service to attack, disrupt, or gain
              unauthorized access to our infrastructure or other users&apos;
              accounts. We may suspend access for abuse at our discretion.
            </p>
          </section>

          <section>
            <h2 className="font-mono text-base text-accent">5. No warranty</h2>
            <p className="mt-2">
              The Service is provided &quot;as is&quot; without warranties of any
              kind. We don&apos;t guarantee uninterrupted or error-free
              operation.
            </p>
          </section>

          <section>
            <h2 className="font-mono text-base text-accent">6. Limitation of liability</h2>
            <p className="mt-2">
              To the fullest extent permitted by law, Royale.Rocks and its
              operators are not liable for any indirect, incidental, or
              consequential damages arising from your use of the Service.
            </p>
          </section>

          <section>
            <h2 className="font-mono text-base text-accent">7. Changes</h2>
            <p className="mt-2">
              We may update these terms as the Service evolves. Continued use
              after changes means you accept the updated terms.
            </p>
          </section>

          <section>
            <h2 className="font-mono text-base text-accent">8. Contact</h2>
            <p className="mt-2">
              Questions about these terms? Reach out via the contact
              information on our GitHub repository.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
