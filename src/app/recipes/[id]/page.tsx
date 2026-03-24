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
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <SiteNav />
      <article className="mx-auto max-w-3xl px-4 py-10">
        <div className="mb-8 flex flex-col gap-6 sm:flex-row sm:items-start">
          {recipe.thumbnailUrl ? (
            <Image
              src={recipe.thumbnailUrl}
              alt={recipe.title}
              width={320}
              height={320}
              className="w-full max-w-xs shrink-0 rounded-2xl object-cover shadow-xl shadow-black/40 sm:w-48"
              priority
            />
          ) : null}
          <div className="min-w-0 flex-1">
            <h1 className="text-3xl font-semibold tracking-tight text-white">
              {recipe.title}
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              {[recipe.category, recipe.area].filter(Boolean).join(" · ") ||
                "TheMealDB"}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href={`/cook/${recipe.id}`}
                className="rounded-full bg-cyan-500 px-6 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/25 hover:bg-cyan-400"
              >
                Cooking mode
              </Link>
              <Link
                href="/recipes"
                className="rounded-full border border-white/20 px-6 py-2.5 text-sm text-slate-200 hover:bg-white/10"
              >
                Back to search
              </Link>
            </div>
          </div>
        </div>

        {recipe.ingredients.length > 0 && (
          <section className="mb-10">
            <h2 className="mb-3 text-lg font-medium text-white">Ingredients</h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {recipe.ingredients.map((ing) => (
                <li
                  key={`${ing.name}-${ing.measure}`}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200"
                >
                  <span className="font-medium text-white">{ing.name}</span>
                  {ing.measure ? (
                    <span className="text-slate-400"> · {ing.measure}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h2 className="mb-3 text-lg font-medium text-white">Steps</h2>
          <ol className="list-decimal space-y-3 pl-5 text-slate-300">
            {recipe.steps.map((step, i) => (
              <li key={i} className="pl-1 leading-relaxed">
                {step}
              </li>
            ))}
          </ol>
        </section>
      </article>
    </div>
  );
}
