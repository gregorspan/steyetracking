import { SiteNav } from "@/components/SiteNav";
import { searchMeals } from "@/lib/recipes/service";
import Image from "next/image";
import { RecipeSearch } from "@/components/recipes/RecipeSearch";
import Link from "next/link";

async function getHomeRecipes() {
  // Fixed "top 3 this week" seed terms for a stable homepage lineup.
  const terms = ["chicken", "pasta", "beef"];
  const all = await Promise.all(terms.map((t) => searchMeals(t)));
  const seen = new Set<string>();
  const merged = all
    .map((list) => list[0])
    .filter(Boolean)
    .filter((r) => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    })
    .slice(0, 3);
  return merged;
}

export default async function Home() {
  const recipes = await getHomeRecipes();
  return (
    <div className="min-h-screen bg-[#0D0D0F] text-[#E8E8EC]">
      <SiteNav />
      <main className="mx-auto w-full max-w-6xl px-5 py-10 sm:py-14">
        <p className="text-xs uppercase tracking-[0.22em] text-[#BFC0CC]">
          Look &amp; Cook
        </p>
        <div className="mt-4 grid gap-8 lg:grid-cols-[1.3fr_1fr] lg:items-end">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
              Cook without touching
              <br />
              your screen.
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-relaxed text-[#BFC0CC] sm:text-base">
              Search recipes and move through steps using eye tracking, voice
              commands, or both. Built for real kitchen moments when your hands are
              wet, messy, or busy.
            </p>
          </div>

          <div className="border border-white/10 p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-[#BFC0CC]">
              How It Works
            </p>
            <ol className="mt-4 space-y-3 text-sm text-[#E8E8EC]">
              <li>
                <span className="text-[#F5A623]">1.</span> Search and open a recipe.
              </li>
              <li>
                <span className="text-[#F5A623]">2.</span> Start cooking mode and
                calibrate eye tracking.
              </li>
              <li>
                <span className="text-[#F5A623]">3.</span> Navigate steps with gaze
                zones or voice commands.
              </li>
            </ol>
          </div>
        </div>

        <section id="search-recipes" className="mt-10 border-t border-white/10 pt-8">
          <p className="text-xs uppercase tracking-[0.16em] text-[#BFC0CC]">
            Search
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">
            Find any recipe
          </h2>
          <p className="mt-3 max-w-3xl text-sm text-[#BFC0CC]">
            Type ingredients or dish names and open a recipe directly.
          </p>
          <div className="mt-5">
            <RecipeSearch
              showLabel={false}
              showDebounceHint={false}
              enableVoiceSearch
            />
          </div>
        </section>

        <section id="recipes-catalog" className="mt-12 border-t border-white/10 pt-8">
          <p className="text-xs uppercase tracking-[0.16em] text-[#BFC0CC]">
            Featured
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">
            Start with one of this week's top 3 recipes
          </h2>
          <p className="mt-3 max-w-3xl text-sm text-[#BFC0CC]">
            Pick one and jump straight into cooking mode.
          </p>

          <ul className="mt-6 grid gap-4 sm:grid-cols-3">
            {recipes.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/recipes/${r.id}`}
                  className="group block border border-white/10 bg-[#121216] p-2 transition hover:border-[#E8E8EC]"
                >
                  {r.thumbnailUrl ? (
                    <Image
                      src={r.thumbnailUrl}
                      alt={r.title}
                      width={320}
                      height={220}
                      className="h-44 w-full object-cover"
                    />
                  ) : (
                    <div className="h-44 w-full border border-white/10" />
                  )}
                  <span className="mt-3 flex items-center justify-between px-1 pb-1">
                    <span className="font-medium text-[#E8E8EC] line-clamp-2">
                      {r.title}
                    </span>
                    <span className="ml-3 shrink-0 text-xs text-[#BFC0CC] group-hover:text-[#E8E8EC]">
                      Open →
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
