/** Raw meal object from TheMealDB JSON API (subset + index access for strIngredientN). */
export interface MealDbMeal {
  idMeal: string;
  strMeal: string;
  strMealThumb?: string | null;
  strInstructions?: string | null;
  strCategory?: string | null;
  strArea?: string | null;
  [key: string]: string | null | undefined;
}

export interface MealDbListResponse {
  meals: MealDbMeal[] | null;
}
