import { signIn } from "@/auth";

export const metadata = {
  title: "Sign in — Royale.Rocks",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-8 px-6 py-24 text-center">
      <h1 className="text-3xl font-mono tracking-tight">Sign in to play</h1>
      <p className="max-w-sm text-foreground/60">
        Sign in with Google to save your scores and appear on the
        leaderboard. You can still play without an account.
      </p>
      <form
        action={async () => {
          "use server";
          await signIn("google", { redirectTo: callbackUrl || "/" });
        }}
      >
        <button
          type="submit"
          className="flex items-center gap-3 rounded-full border border-black/10 bg-white px-6 py-3 font-medium text-foreground shadow-sm hover:bg-accent-soft transition-colors"
        >
          <GoogleIcon />
          Continue with Google
        </button>
      </form>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.71H.92v2.33A9 9 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.71A5.4 5.4 0 0 1 3.68 9c0-.59.1-1.17.29-1.71V4.96H.92A9 9 0 0 0 0 9c0 1.45.35 2.83.92 4.04l3.05-2.33z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.59-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .92 4.96l3.05 2.33C4.68 5.16 6.66 3.58 9 3.58z"
      />
    </svg>
  );
}
