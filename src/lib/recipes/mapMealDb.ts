import type { MealDbMeal } from "@/types/mealdb";
import type { RecipeDetail, RecipeIngredient, RecipeSummary } from "@/types/recipe";

function splitInstructions(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  const normalized = raw.replace(/\r\n/g, "\n").trim();

  const numbered = normalized.split(/\n(?=\s*\d+[\.)]\s)/);
  if (numbered.length > 1) {
    return numbered
      .map((s) => s.replace(/^\s*\d+[\.)]\s*/, "").trim())
      .filter(Boolean);
  }

  return normalized
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function collectIngredients(meal: MealDbMeal): RecipeIngredient[] {
  const out: RecipeIngredient[] = [];
  for (let i = 1; i <= 20; i++) {
    const name = meal[`strIngredient${i}`]?.trim();
    if (!name) continue;
    const measure = meal[`strMeasure${i}`]?.trim() ?? "";
    out.push({ name, measure });
  }
  return out;
}

export function mapMealToSummary(meal: MealDbMeal): RecipeSummary {
  return {
    id: meal.idMeal,
    title: meal.strMeal,
    thumbnailUrl: meal.strMealThumb?.trim() || null,
  };
}

export function mapMealToDetail(meal: MealDbMeal): RecipeDetail {
  const summary = mapMealToSummary(meal);
  let steps = splitInstructions(meal.strInstructions);
  if (steps.length === 0 && meal.strInstructions?.trim()) {
    steps = [meal.strInstructions.trim()];
  }
  return {
    ...summary,
    category: meal.strCategory?.trim() || null,
    area: meal.strArea?.trim() || null,
    ingredients: collectIngredients(meal),
    steps,
  };
}
