import Link from "next/link";

export default function CookNotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 text-center text-slate-100">
      <h1 className="text-2xl font-semibold text-white">Recipe not found</h1>
      <p className="mt-3 max-w-sm text-sm text-slate-400">
        Cannot open cooking mode for this recipe.
      </p>
      <Link
        href="/recipes"
        className="mt-8 rounded-full bg-cyan-500 px-6 py-2.5 text-sm font-semibold text-slate-950 hover:bg-cyan-400"
      >
        Search recipes
      </Link>
    </div>
  );
}
