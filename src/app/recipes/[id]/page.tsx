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
    <div className="min-h-screen bg-[#FAFAF9] text-[#1A1A1E]">
      <SiteNav />
      <article className="mx-auto max-w-3xl px-5 py-12">
        <div className="mb-12 grid gap-8 border-b border-[#E5E5E3] pb-10 md:grid-cols-[200px_1fr]">
          {recipe.thumbnailUrl ? (
            <Image
              src={recipe.thumbnailUrl}
              alt={recipe.title}
              width={320}
              height={320}
              className="h-48 w-full object-cover md:h-52 rounded"
              priority
            />
          ) : (
            <div className="h-48 w-full rounded bg-[#F0F0EE] md:h-52" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm text-[#8E8E93]">
              {[recipe.category, recipe.area].filter(Boolean).join(" · ") ||
                "TheMealDB"}
            </p>
            <h1
              className="mt-2 text-3xl font-semibold sm:text-4xl"
              style={{ letterSpacing: "-0.02em" }}
            >
              {recipe.title}
            </h1>

            <div className="mt-8 border border-[#E5E5E3] bg-white p-5">
              <p className="text-sm font-semibold text-[#1A1A1E]">
                Hands-free mode
              </p>
              <p className="mt-1.5 text-[15px] text-[#8E8E93]">
                Opens a focused step-by-step view with eye tracking and voice
                commands.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  href={`/cook/${recipe.id}`}
                  className="rounded-full bg-[#E8850A] px-6 py-2.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#d4780a]"
                >
                  Start cooking mode
                </Link>
                <Link
                  href="/"
                  className="rounded px-5 py-2.5 text-sm text-[#8E8E93] transition-colors duration-150 hover:bg-[#F0F0EE] hover:text-[#1A1A1E]"
                >
                  Back to home
                </Link>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <Link
                href="#ingredients"
                className="rounded px-3 py-1.5 text-xs text-[#8E8E93] border border-[#E5E5E3] transition-colors duration-150 hover:border-[#1A1A1E] hover:text-[#1A1A1E]"
              >
                Ingredients
              </Link>
              <Link
                href="#steps"
                className="rounded px-3 py-1.5 text-xs text-[#8E8E93] border border-[#E5E5E3] transition-colors duration-150 hover:border-[#1A1A1E] hover:text-[#1A1A1E]"
              >
                Steps
              </Link>
            </div>
          </div>
        </div>

        {recipe.ingredients.length > 0 && (
          <section id="ingredients" className="mb-12">
            <h2
              className="mb-5 text-lg font-semibold"
              style={{ letterSpacing: "-0.01em" }}
            >
              Ingredients
            </h2>
            <ul className="grid gap-x-6 gap-y-0 sm:grid-cols-2">
              {recipe.ingredients.map((ing) => (
                <li
                  key={`${ing.name}-${ing.measure}`}
                  className="border-b border-[#E5E5E3] py-2.5 text-[15px]"
                >
                  <span className="font-medium text-[#1A1A1E]">{ing.name}</span>
                  {ing.measure ? (
                    <span className="text-[#8E8E93]"> · {ing.measure}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section id="steps">
          <h2
            className="mb-5 text-lg font-semibold"
            style={{ letterSpacing: "-0.01em" }}
          >
            Preparation steps
          </h2>
          <ol className="space-y-5">
            {recipe.steps.map((step, i) => (
              <li key={i} className="grid grid-cols-[2rem_1fr] gap-3 border-b border-[#E5E5E3] pb-5">
                <span className="text-sm font-semibold text-[#E8850A]">
                  {(i + 1).toString().padStart(2, "0")}
                </span>
                <p className="text-[15px] leading-relaxed text-[#1A1A1E]">{step}</p>
              </li>
            ))}
          </ol>
        </section>
      </article>
    </div>
  );
}
