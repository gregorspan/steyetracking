import { RecipeCookClient } from "@/components/recipes/RecipeCookClient";
import { getRecipeById } from "@/lib/recipes/service";
import { notFound } from "next/navigation";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const recipe = await getRecipeById(id);
  if (!recipe) return { title: "Cooking mode" };
  return { title: `Cook · ${recipe.title}` };
}

export default async function CookPage({ params }: Props) {
  const { id } = await params;
  const recipe = await getRecipeById(id);
  if (!recipe) notFound();

  return <RecipeCookClient recipe={recipe} />;
}
