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
    <div className="min-h-screen bg-[#FAFAF9] text-[#1A1A1E]">
      <SiteNav />
      <main className="mx-auto w-full max-w-4xl px-5 py-14 sm:py-20">
        <div className="mb-16 grid gap-10 lg:grid-cols-[1.4fr_1fr] lg:items-start">
          <div>
            <h1
              className="text-4xl font-semibold sm:text-5xl"
              style={{ letterSpacing: "-0.02em", lineHeight: 1.15 }}
            >
              Cook without touching
              <br />
              your screen.
            </h1>
            <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-[#8E8E93]">
              Search recipes and move through steps using eye tracking, voice
              commands, or both. Built for real kitchen moments when your hands
              are wet, messy, or busy.
            </p>
          </div>

          <div className="border border-[#E5E5E3] p-5">
            <p className="text-sm font-semibold text-[#1A1A1E]">How it works</p>
            <ol className="mt-4 space-y-3 text-[15px] text-[#1A1A1E]">
              <li>
                <span className="font-semibold text-[#E8850A]">1.</span>{" "}
                Search and open a recipe.
              </li>
              <li>
                <span className="font-semibold text-[#E8850A]">2.</span>{" "}
                Start cooking mode and calibrate eye tracking.
              </li>
              <li>
                <span className="font-semibold text-[#E8850A]">3.</span>{" "}
                Navigate steps with gaze zones or voice commands.
              </li>
            </ol>
          </div>
        </div>

        <section id="search-recipes" className="border-t border-[#E5E5E3] pt-10">
          <h2
            className="text-2xl font-semibold"
            style={{ letterSpacing: "-0.02em" }}
          >
            Find any recipe
          </h2>
          <p className="mt-2 text-[15px] text-[#8E8E93]">
            Type ingredients or dish names and open a recipe directly.
          </p>
          <div className="mt-6">
            <RecipeSearch
              showLabel={false}
              showDebounceHint={false}
              enableVoiceSearch
            />
          </div>
        </section>

        <section id="recipes-catalog" className="mt-16 border-t border-[#E5E5E3] pt-10">
          <h2
            className="text-2xl font-semibold"
            style={{ letterSpacing: "-0.02em" }}
          >
            Featured recipes
          </h2>
          <p className="mt-2 text-[15px] text-[#8E8E93]">
            Pick one and jump straight into cooking mode.
          </p>

          <ul className="mt-8 grid gap-5 sm:grid-cols-3">
            {recipes.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/recipes/${r.id}`}
                  className="group block border border-[#E5E5E3] bg-white transition-colors duration-150 hover:border-[#1A1A1E]"
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
                    <div className="h-44 w-full bg-[#F0F0EE]" />
                  )}
                  <span className="mt-3 flex items-center justify-between px-3 pb-3">
                    <span className="font-medium text-[#1A1A1E] line-clamp-2 text-[15px]">
                      {r.title}
                    </span>
                    <span className="ml-3 shrink-0 text-xs text-[#8E8E93] transition group-hover:text-[#1A1A1E]">
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
