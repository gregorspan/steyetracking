import Link from "next/link";

export function SiteNav() {
  return (
    <nav
      className="flex items-center justify-between border-b border-[#E5E5E3] bg-[#FAFAF9] px-5 py-3 sm:px-8"
      aria-label="Main"
    >
      <Link
        href="/"
        className="text-sm font-semibold tracking-[-0.01em] text-[#1A1A1E] transition hover:text-[#E8850A]"
        style={{ letterSpacing: "-0.01em" }}
      >
        GazeChef
      </Link>
      <div className="flex items-center gap-6 text-sm text-[#8E8E93]">
        <Link href="/" className="transition hover:text-[#1A1A1E]">
          Home
        </Link>
      </div>
    </nav>
  );
}
