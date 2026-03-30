import { SiteNav } from "@/components/SiteNav";
import { searchMeals } from "@/lib/recipes/service";
import Image from "next/image";
import { RecipeSearch } from "@/components/recipes/RecipeSearch";
import Link from "next/link";

async function getHomeRecipes() {
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
    <div className="min-h-screen bg-[var(--bg)] text-[var(--fg)]">
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
            <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-[var(--muted)]">
              Search recipes and move through steps using eye tracking, voice
              commands, or both. Built for real kitchen moments when your hands
              are wet, messy, or busy.
            </p>
          </div>

          <div className="border border-[var(--border)] p-5">
            <p className="text-sm font-semibold text-[var(--fg)]">How it works</p>
            <ol className="mt-4 space-y-3 text-[15px] text-[var(--fg)]">
              <li>
                <span className="font-semibold text-[var(--accent)]">1.</span>{" "}
                Search and open a recipe.
              </li>
              <li>
                <span className="font-semibold text-[var(--accent)]">2.</span>{" "}
                Start cooking mode and calibrate eye tracking.
              </li>
              <li>
                <span className="font-semibold text-[var(--accent)]">3.</span>{" "}
                Navigate steps with gaze zones or voice commands.
              </li>
            </ol>
          </div>
        </div>

        <section id="search-recipes" className="border-t border-[var(--border)] pt-10">
          <h2
            className="text-2xl font-semibold"
            style={{ letterSpacing: "-0.02em" }}
          >
            Find any recipe
          </h2>
          <p className="mt-2 text-[15px] text-[var(--muted)]">
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

        <section id="recipes-catalog" className="mt-16 border-t border-[var(--border)] pt-10">
          <h2
            className="text-2xl font-semibold"
            style={{ letterSpacing: "-0.02em" }}
          >
            Featured recipes
          </h2>
          <p className="mt-2 text-[15px] text-[var(--muted)]">
            Pick one and jump straight into cooking mode.
          </p>

          <ul className="mt-8 grid gap-5 sm:grid-cols-3">
            {recipes.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/recipes/${r.id}`}
                  className="group block border border-[var(--border)] bg-[var(--surface)] transition-colors duration-150 hover:border-[var(--fg)]"
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
                    <div className="h-44 w-full bg-[var(--hover-bg)]" />
                  )}
                  <span className="mt-3 flex items-center justify-between px-3 pb-3">
                    <span className="font-medium text-[var(--fg)] line-clamp-2 text-[15px]">
                      {r.title}
                    </span>
                    <span className="ml-3 shrink-0 text-xs text-[var(--muted)] transition group-hover:text-[var(--fg)]">
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
