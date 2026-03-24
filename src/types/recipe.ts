export type RecipeSummary = {
  id: string;
  title: string;
  thumbnailUrl: string | null;
};

export type RecipeIngredient = {
  name: string;
  measure: string;
};

export type RecipeDetail = RecipeSummary & {
  category: string | null;
  area: string | null;
  ingredients: RecipeIngredient[];
  steps: string[];
};
