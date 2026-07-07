import Image from "next/image";
import Link from "next/link";
import { auth, signOut } from "@/auth";

export default async function AuthStatus() {
  const session = await auth();

  if (!session?.user) {
    return (
      <Link
        href="/signin"
        className="rounded-md border border-accent/30 px-4 py-1.5 text-sm hover:border-accent hover:text-accent transition-colors"
      >
        Sign in
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-3">
      {session.user.image && (
        <Image
          src={session.user.image}
          alt={session.user.name ?? "Account"}
          width={28}
          height={28}
          className="rounded-full"
        />
      )}
      <span className="hidden sm:inline text-sm text-foreground/70">
        {session.user.name}
      </span>
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/" });
        }}
      >
        <button
          type="submit"
          className="text-sm text-foreground/50 hover:text-accent transition-colors"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
