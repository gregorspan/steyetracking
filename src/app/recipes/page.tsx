import { RecipeSearch } from "@/components/recipes/RecipeSearch";
import { SiteNav } from "@/components/SiteNav";

export default function RecipesPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <SiteNav />
      <div className="mx-auto max-w-4xl px-4 pb-16 pt-10 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-white">
          Recipe library
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-slate-400">
          Search TheMealDB for real recipes. Open a recipe for ingredients and
          instructions, then switch to cooking mode for a large step-by-step
          view—ready for hands-free control later.
        </p>
      </div>
      <div className="mx-auto max-w-4xl px-4 pb-20">
        <RecipeSearch />
      </div>
    </div>
  );
}
