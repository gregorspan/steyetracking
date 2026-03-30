"use client";

import type { RecipeSummary } from "@/types/recipe";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

const DEBOUNCE_MS = 400;

type Props = {
  showLabel?: boolean;
  showDebounceHint?: boolean;
  enableVoiceSearch?: boolean;
};

export function RecipeSearch({
  showLabel = true,
  showDebounceHint = true,
  enableVoiceSearch = false,
}: Props) {
  const [query, setQuery] = useState("");
  const [recipes, setRecipes] = useState<RecipeSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [voiceHint, setVoiceHint] = useState<string | null>(null);

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

  const startVoiceSearch = () => {
    if (!enableVoiceSearch || typeof window === "undefined") return;
    const maybe = window as unknown as {
      SpeechRecognition?: new () => {
        lang: string;
        interimResults: boolean;
        continuous: boolean;
        onresult: ((event: unknown) => void) | null;
        onerror: ((event: unknown) => void) | null;
        onend: (() => void) | null;
        start: () => void;
      };
      webkitSpeechRecognition?: new () => {
        lang: string;
        interimResults: boolean;
        continuous: boolean;
        onresult: ((event: unknown) => void) | null;
        onerror: ((event: unknown) => void) | null;
        onend: (() => void) | null;
        start: () => void;
      };
    };
    const Ctor = maybe.SpeechRecognition ?? maybe.webkitSpeechRecognition;
    if (!Ctor) {
      setVoiceHint("Voice search is not supported in this browser.");
      return;
    }

    setVoiceHint(null);
    const rec = new Ctor();
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (event: unknown) => {
      const e = event as {
        results?: ArrayLike<ArrayLike<{ transcript?: string }>>;
      };
      const chunk = e.results?.[e.results.length - 1]?.[0]?.transcript?.trim();
      if (chunk) setQuery(chunk);
    };
    rec.onerror = () => {
      setVoiceHint("Mic access failed. Check permission and try again.");
    };
    rec.onend = () => setListening(false);
    try {
      setListening(true);
      rec.start();
    } catch {
      setListening(false);
      setVoiceHint("Could not start voice input.");
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <div className="flex flex-col gap-2">
        <label className="flex flex-col gap-2 text-left text-sm text-[#BFC0CC]">
          {showLabel ? "Search TheMealDB" : ""}
          <div className="flex items-stretch gap-2">
            {enableVoiceSearch && (
              <button
                type="button"
                onClick={startVoiceSearch}
                aria-label="Voice search"
                className={`h-12 w-12 shrink-0 rounded-full border text-lg transition ${
                  listening
                    ? "border-[#F5A623] bg-[#F5A623] text-[#0D0D0F]"
                    : "border-white/20 bg-[#121216] text-[#E8E8EC] hover:border-[#E8E8EC]"
                }`}
              >
                🎤
              </button>
            )}
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. chicken, pasta, curry"
              className="min-w-0 flex-1 border border-white/20 bg-[#121216] px-4 py-3 text-base text-[#E8E8EC] placeholder:text-[#BFC0CC] focus:border-[#E8E8EC] focus:outline-none"
              autoComplete="off"
              aria-busy={loading}
            />
          </div>
        </label>
        {enableVoiceSearch && voiceHint && (
          <p className="text-xs text-[#BFC0CC]">{voiceHint}</p>
        )}
        {showDebounceHint && (
          <p className="text-xs text-[#BFC0CC]">
            Results appear as you type with a short delay.
          </p>
        )}
      </div>

      {loading && (
        <p className="text-center text-sm text-[#BFC0CC]">Searching…</p>
      )}

      {error && (
        <p className="border border-red-500/40 bg-transparent px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}

      {showEmptyHint && (
        <p className="text-center text-sm text-[#BFC0CC]">
          No recipes found. Try another keyword.
        </p>
      )}

      <ul className="divide-y divide-white/10 border-y border-white/10">
        {recipes.map((r) => (
          <li key={r.id}>
            <Link
              href={`/recipes/${r.id}`}
              className="group flex items-center gap-4 px-2 py-4 transition hover:bg-white/[0.02]"
            >
              {r.thumbnailUrl ? (
                <Image
                  src={r.thumbnailUrl}
                  alt={r.title}
                  width={96}
                  height={96}
                  className="h-14 w-14 shrink-0 object-cover"
                />
              ) : (
                <div className="h-14 w-14 shrink-0 border border-white/10" />
              )}
              <span className="flex flex-1 items-center justify-between text-left">
                <span className="font-medium text-[#E8E8EC]">{r.title}</span>
                <span className="text-xs text-[#BFC0CC] group-hover:text-[#E8E8EC]">
                  Open →
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
