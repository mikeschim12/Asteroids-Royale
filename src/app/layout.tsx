import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import AuthStatus from "@/components/AuthStatus";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Asteroids Royale",
  description: "A battle-royale twist on the arcade classic.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <header className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-black/20 backdrop-blur">
          <Link href="/" className="font-mono text-lg tracking-wide">
            ASTEROIDS <span className="text-amber-400">ROYALE</span>
          </Link>
          <div className="flex items-center gap-6">
            <nav className="flex gap-6 text-sm text-white/70">
              <Link href="/" className="hover:text-amber-400">
                Home
              </Link>
              <Link href="/play" className="hover:text-amber-400">
                Play
              </Link>
            </nav>
            <Suspense fallback={<div className="h-7 w-16" />}>
              <AuthStatus />
            </Suspense>
          </div>
        </header>
        <main className="flex-1 flex flex-col">{children}</main>
        <footer className="px-6 py-4 text-xs text-center text-white/40 border-t border-white/10">
          Asteroids Royale
        </footer>
      </body>
    </html>
  );
}
