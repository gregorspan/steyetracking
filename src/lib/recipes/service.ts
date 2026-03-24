import type { MealDbListResponse } from "@/types/mealdb";
import type { RecipeDetail, RecipeSummary } from "@/types/recipe";
import { MEALDB_BASE } from "@/lib/mealdb/constants";
import { mapMealToDetail, mapMealToSummary } from "@/lib/recipes/mapMealDb";

const fetchOptions = { next: { revalidate: 3600 } } as const;

async function fetchMealDbList(
  path: string,
): Promise<MealDbListResponse | null> {
  const res = await fetch(`${MEALDB_BASE}${path}`, fetchOptions);
  if (!res.ok) return null;
  return (await res.json()) as MealDbListResponse;
}

export async function searchMeals(query: string): Promise<RecipeSummary[]> {
  const q = query.trim();
  if (!q) return [];
  const data = await fetchMealDbList(`/search.php?s=${encodeURIComponent(q)}`);
  if (!data?.meals?.length) return [];
  return data.meals.map(mapMealToSummary);
}

export async function getRecipeById(
  id: string,
): Promise<RecipeDetail | null> {
  const safe = id.trim();
  if (!safe) return null;
  const data = await fetchMealDbList(`/lookup.php?i=${encodeURIComponent(safe)}`);
  const meal = data?.meals?.[0];
  if (!meal) return null;
  return mapMealToDetail(meal);
}
