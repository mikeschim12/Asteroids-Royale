import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import AuthStatus from "@/components/AuthStatus";
import Footer from "@/components/Footer";
import CookieConsent from "@/components/CookieConsent";
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
  metadataBase: new URL("https://royale.rocks"),
  title: "Royale.Rocks",
  description:
    "The arcade classic, reborn as a battle royale. Dodge rocks, dodge ships, and outlast AI bots inside a shrinking arena.",
  openGraph: {
    title: "Royale.Rocks",
    description:
      "The arcade classic, reborn as a battle royale. Play free in your browser.",
    url: "https://royale.rocks",
    siteName: "Royale.Rocks",
  },
  twitter: {
    card: "summary_large_image",
    title: "Royale.Rocks",
    description:
      "The arcade classic, reborn as a battle royale. Play free in your browser.",
  },
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
      <body className="min-h-full flex flex-col bg-background text-foreground font-mono">
        <header className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 sm:py-4 border-b border-accent/25 bg-black/80 backdrop-blur">
          <Link href="/" className="font-mono text-base sm:text-lg tracking-wide">
            ROYALE<span className="text-accent">.ROCKS</span>
          </Link>
          <div className="flex items-center gap-3 sm:gap-6">
            <nav className="flex gap-3 sm:gap-6 text-sm text-foreground/70">
              <Link href="/" className="hover:text-accent">
                Home
              </Link>
              <Link href="/play" className="hover:text-accent">
                Play
              </Link>
            </nav>
            <Suspense fallback={<div className="h-7 w-16" />}>
              <AuthStatus />
            </Suspense>
          </div>
        </header>
        <main className="flex-1 flex flex-col">{children}</main>
        <Footer />
        <CookieConsent />
      </body>
    </html>
  );
}
