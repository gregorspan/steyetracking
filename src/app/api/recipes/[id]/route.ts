import { getRecipeById } from "@/lib/recipes/service";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  try {
    const recipe = await getRecipeById(id);
    if (!recipe) {
      return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
    }
    return NextResponse.json({ recipe });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch recipe" },
      { status: 502 },
    );
  }
}
