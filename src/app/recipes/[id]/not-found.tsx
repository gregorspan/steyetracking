import { SiteNav } from "@/components/SiteNav";
import Link from "next/link";

export default function RecipeNotFound() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <SiteNav />
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="text-2xl font-semibold text-white">Recipe not found</h1>
        <p className="mt-3 text-sm text-slate-400">
          This ID is not in TheMealDB or the request failed.
        </p>
        <Link
          href="/recipes"
          className="mt-8 inline-block rounded-full bg-cyan-500 px-6 py-2.5 text-sm font-semibold text-slate-950 hover:bg-cyan-400"
        >
          Search recipes
        </Link>
      </div>
    </div>
  );
}
