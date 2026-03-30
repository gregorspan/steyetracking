"use client";

import type { RecipeSummary } from "@/types/recipe";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

const DEBOUNCE_MS = 400;

export function RecipeSearch() {
  const [query, setQuery] = useState("");
  const [recipes, setRecipes] = useState<RecipeSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    const ac = new AbortController();

    if (!trimmed) {
      setRecipes([]);
      setError(null);
      setLoading(false);
      return () => ac.abort();
    }

    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/recipes/search?q=${encodeURIComponent(trimmed)}`,
          { signal: ac.signal },
        );
        const data = (await res.json()) as {
          recipes?: RecipeSummary[];
          error?: string;
        };
        if (!res.ok) {
          setError(data.error ?? "Search failed");
          setRecipes([]);
          return;
        }
        setRecipes(data.recipes ?? []);
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setError("Network error. Try again.");
        setRecipes([]);
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      ac.abort();
    };
  }, [query]);

  const showEmptyHint =
    query.trim().length > 0 && !loading && recipes.length === 0 && !error;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <div className="flex flex-col gap-2">
        <label className="flex flex-col gap-2 text-left text-sm text-slate-400">
          Search TheMealDB
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. chicken, pasta, curry"
            className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-base text-white placeholder:text-slate-500 focus:border-cyan-500/60 focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
            autoComplete="off"
            aria-busy={loading}
          />
        </label>
        <p className="text-xs text-slate-500">
          Results appear as you type ({DEBOUNCE_MS / 1000}s debounce).
        </p>
      </div>

      {loading && (
        <p className="text-center text-sm text-slate-500">Searching…</p>
      )}

      {error && (
        <p className="rounded-xl border border-red-500/30 bg-red-950/40 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      )}

      {showEmptyHint && (
        <p className="text-center text-sm text-slate-500">
          No recipes found. Try another keyword.
        </p>
      )}

      <ul className="grid gap-4 sm:grid-cols-2">
        {recipes.map((r) => (
          <li key={r.id}>
            <Link
              href={`/recipes/${r.id}`}
              className="group flex gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:border-cyan-500/40 hover:bg-white/10"
            >
              {r.thumbnailUrl ? (
                <Image
                  src={r.thumbnailUrl}
                  alt={r.title}
                  width={96}
                  height={96}
                  className="h-24 w-24 shrink-0 rounded-lg object-cover"
                />
              ) : (
                <div className="h-24 w-24 shrink-0 rounded-lg bg-white/10" />
              )}
              <span className="flex items-center text-left font-medium text-white group-hover:text-cyan-200">
                {r.title}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
