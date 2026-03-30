import { searchMeals } from "@/lib/recipes/service";
import { NextResponse } from "next/server";

const MAX_QUERY = 120;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  if (q.length > MAX_QUERY) {
    return NextResponse.json({ error: "Query too long" }, { status: 400 });
  }
  try {
    const recipes = await searchMeals(q);
    return NextResponse.json({ recipes });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch recipes" },
      { status: 502 },
    );
  }
}
