import Link from "next/link";

export function SiteNav() {
  return (
    <nav
      className="flex flex-wrap items-center justify-center gap-6 border-b border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-slate-300 backdrop-blur"
      aria-label="Main"
    >
      <Link href="/" className="hover:text-white">
        Eye tracking
      </Link>
      <Link href="/recipes" className="hover:text-white">
        Recipes
      </Link>
    </nav>
  );
}
