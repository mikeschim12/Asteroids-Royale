import Link from "next/link";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 px-4 sm:px-6 py-4 text-xs text-center text-foreground/40 border-t border-black/10">
      <span>&copy; {year} Royale.Rocks. All rights reserved.</span>
      <span className="hidden sm:inline">&middot;</span>
      <div className="flex items-center gap-4">
        <Link href="/terms" className="hover:text-accent">
          Terms of Service
        </Link>
        <Link href="/privacy" className="hover:text-accent">
          Privacy Policy
        </Link>
      </div>
    </footer>
  );
}
