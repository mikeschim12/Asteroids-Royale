"use client";

import { usePathname } from "next/navigation";
import Footer from "@/components/Footer";
import CookieConsent from "@/components/CookieConsent";

export default function SiteChrome() {
  const pathname = usePathname();
  const isPlaying = pathname?.startsWith("/play");

  if (isPlaying) return null;

  return (
    <>
      <Footer />
      <CookieConsent />
    </>
  );
}
