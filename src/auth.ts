import NextAuth, { type DefaultSession } from "next-auth";
import Google from "next-auth/providers/google";

declare module "next-auth" {
  interface Session {
    user?: {
      id?: string;
    } & DefaultSession["user"];
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [Google],
  pages: {
    signIn: "/signin",
  },
  callbacks: {
    // Expose the stable per-account id (the JWT's `sub`) on the session so
    // features that need to identify a user across visits (e.g. the
    // leaderboard) have something durable to key on, not just a name.
    session({ session, token }) {
      if (session.user && token.sub) session.user.id = token.sub;
      return session;
    },
  },
  // Railway (like most non-Vercel hosts) sits behind a reverse proxy, so
  // Auth.js needs to trust the forwarded host/proto headers to build
  // correct callback URLs instead of defaulting to internal ones.
  trustHost: true,
});
