"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const STORAGE_KEY = "royale-rocks-cookie-consent";

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // One-time read of an external system (localStorage) on mount to decide
    // whether to show the banner — not a state-derivation loop.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVisible(!window.localStorage.getItem(STORAGE_KEY));
  }, []);

  const accept = () => {
    window.localStorage.setItem(STORAGE_KEY, "accepted");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:right-auto z-50 max-w-sm rounded-2xl border border-black/10 bg-white p-4 shadow-lg">
      <p className="text-sm text-foreground/70">
        We use cookies to keep you signed in and understand basic site usage.
        See our{" "}
        <Link href="/privacy" className="text-accent hover:underline">
          Privacy Policy
        </Link>{" "}
        for details.
      </p>
      <div className="mt-3 flex justify-end gap-3">
        <button
          type="button"
          onClick={accept}
          className="rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-white hover:bg-accent/90 transition-colors"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
