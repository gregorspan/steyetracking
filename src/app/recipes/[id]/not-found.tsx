import { SiteNav } from "@/components/SiteNav";
import Link from "next/link";

export default function RecipeNotFound() {
  return (
    <div className="min-h-screen bg-[#0D0D0F] text-[#E8E8EC]">
      <SiteNav />
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="text-2xl font-semibold">Recipe not found</h1>
        <p className="mt-3 text-sm text-[#BFC0CC]">
          This ID is not in TheMealDB or the request failed.
        </p>
        <Link
          href="/"
          className="mt-8 inline-block border border-[#E8E8EC] px-6 py-2.5 text-sm font-semibold text-[#E8E8EC] hover:bg-[#E8E8EC] hover:text-[#0D0D0F]"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}
