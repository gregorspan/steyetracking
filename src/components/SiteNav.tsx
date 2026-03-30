import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";

export function SiteNav() {
  return (
    <nav
      className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--bg)] px-5 py-3 sm:px-8"
      aria-label="Main"
    >
      <Link
        href="/"
        className="text-sm font-semibold text-[var(--fg)] transition-colors duration-150 hover:text-[var(--accent)]"
        style={{ letterSpacing: "-0.01em" }}
      >
        GazeChef
      </Link>
      <div className="flex items-center gap-4 text-sm text-[var(--muted)]">
        <Link href="/" className="transition-colors duration-150 hover:text-[var(--fg)]">
          Home
        </Link>
        <ThemeToggle />
      </div>
    </nav>
  );
}
