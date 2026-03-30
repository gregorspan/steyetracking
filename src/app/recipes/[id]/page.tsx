import { SiteNav } from "@/components/SiteNav";
import { getRecipeById } from "@/lib/recipes/service";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const recipe = await getRecipeById(id);
  if (!recipe) return { title: "Recipe not found" };
  return { title: `${recipe.title} · Hands-free recipe reader` };
}

export default async function RecipeDetailPage({ params }: Props) {
  const { id } = await params;
  const recipe = await getRecipeById(id);
  if (!recipe) notFound();

  return (
    <div className="min-h-screen bg-[#0D0D0F] text-[#E8E8EC]">
      <SiteNav />
      <article className="mx-auto max-w-5xl px-5 py-10">
        <div className="mb-10 grid gap-8 border-b border-white/10 pb-8 md:grid-cols-[220px_1fr]">
          {recipe.thumbnailUrl ? (
            <Image
              src={recipe.thumbnailUrl}
              alt={recipe.title}
              width={320}
              height={320}
              className="h-52 w-full object-cover md:h-56"
              priority
            />
          ) : (
            <div className="h-52 w-full border border-white/10 md:h-56" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase tracking-[0.16em] text-[#BFC0CC]">
              Recipe
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              {recipe.title}
            </h1>
            <p className="mt-3 text-sm text-[#BFC0CC]">
              {[recipe.category, recipe.area].filter(Boolean).join(" · ") ||
                "TheMealDB"}
            </p>
            <div className="mt-7 border border-white/10 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-[#BFC0CC]">
                Hands-free mode
              </p>
              <p className="mt-2 text-sm text-[#E8E8EC]">
                Opens a focused step-by-step view with eye tracking and voice
                commands.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  href={`/cook/${recipe.id}`}
                  className="border border-[#E8E8EC] bg-[#E8E8EC] px-5 py-2.5 text-sm font-semibold text-[#0D0D0F] hover:bg-transparent hover:text-[#E8E8EC]"
                >
                  Start cooking mode
                </Link>
                <Link
                  href="/"
                  className="border border-[#BFC0CC] px-5 py-2.5 text-sm text-[#E8E8EC] hover:border-[#E8E8EC]"
                >
                  Back to home
                </Link>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href="#ingredients"
                className="border border-white/10 px-4 py-1.5 text-xs text-[#BFC0CC] hover:text-[#E8E8EC]"
              >
                Ingredients
              </Link>
              <Link
                href="#steps"
                className="border border-white/10 px-4 py-1.5 text-xs text-[#BFC0CC] hover:text-[#E8E8EC]"
              >
                Steps
              </Link>
            </div>
          </div>
        </div>

        {recipe.ingredients.length > 0 && (
          <section id="ingredients" className="mb-12">
            <h2 className="mb-4 text-lg font-semibold">Ingredients</h2>
            <ul className="grid gap-x-6 gap-y-2 border-y border-white/10 py-4 sm:grid-cols-2">
              {recipe.ingredients.map((ing) => (
                <li
                  key={`${ing.name}-${ing.measure}`}
                  className="border-b border-white/10 py-2 text-sm text-[#E8E8EC]"
                >
                  <span className="font-medium">{ing.name}</span>
                  {ing.measure ? (
                    <span className="text-[#BFC0CC]"> · {ing.measure}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section id="steps">
          <h2 className="mb-4 text-lg font-semibold">Preparation steps</h2>
          <ol className="space-y-4 border-y border-white/10 py-4">
            {recipe.steps.map((step, i) => (
              <li key={i} className="grid grid-cols-[2rem_1fr] gap-3">
                <span className="text-sm font-medium text-[#BFC0CC]">
                  {(i + 1).toString().padStart(2, "0")}
                </span>
                <p className="leading-relaxed text-[#E8E8EC]">{step}</p>
              </li>
            ))}
          </ol>
        </section>
      </article>
    </div>
  );
}
