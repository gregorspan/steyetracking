import Link from "next/link";

export function SiteNav() {
  return (
    <nav
      className="flex flex-wrap items-center justify-center gap-6 border-b border-white/10 bg-[#0D0D0F] px-4 py-3 text-sm text-[#BFC0CC]"
      aria-label="Main"
    >
      <Link href="/" className="hover:text-[#E8E8EC]">
        Home
      </Link>
    </nav>
  );
}
