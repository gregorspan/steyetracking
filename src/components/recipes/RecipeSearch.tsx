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
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-2">
        <label className="flex flex-col gap-3 text-left text-sm text-[#8E8E93]">
          {showLabel ? "Search TheMealDB" : ""}
          <div className="flex items-stretch gap-3">
            {enableVoiceSearch && (
              <button
                type="button"
                onClick={startVoiceSearch}
                aria-label="Voice search"
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition-colors duration-150 ${
                  listening
                    ? "border-[#E8850A] bg-[#E8850A] text-white"
                    : "border-[#E5E5E3] bg-white text-[#8E8E93] hover:border-[#1A1A1E] hover:text-[#1A1A1E]"
                }`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                  aria-hidden="true"
                >
                  <rect x="9" y="2" width="6" height="11" rx="3" />
                  <path d="M5 10a7 7 0 0 0 14 0" />
                  <line x1="12" y1="17" x2="12" y2="21" />
                  <line x1="9" y1="21" x2="15" y2="21" />
                </svg>
              </button>
            )}
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. chicken, pasta, curry"
              className="min-w-0 flex-1 border-b border-[#E5E5E3] bg-transparent px-0 py-2.5 text-[15px] text-[#1A1A1E] placeholder:text-[#8E8E93] focus:border-[#1A1A1E] focus:outline-none transition-colors duration-150"
              autoComplete="off"
              aria-busy={loading}
            />
          </div>
        </label>
        {enableVoiceSearch && voiceHint && (
          <p className="text-xs text-[#8E8E93]">{voiceHint}</p>
        )}
        {showDebounceHint && (
          <p className="text-xs text-[#8E8E93]">
            Results appear as you type with a short delay.
          </p>
        )}
      </div>

      {loading && (
        <p className="text-sm text-[#8E8E93]">Searching…</p>
      )}

      {error && (
        <p className="border-l-2 border-red-400 pl-3 text-sm text-red-500">
          {error}
        </p>
      )}

      {showEmptyHint && (
        <p className="text-sm text-[#8E8E93]">
          No recipes found. Try another keyword.
        </p>
      )}

      <ul className="divide-y divide-[#E5E5E3]">
        {recipes.map((r) => (
          <li key={r.id}>
            <Link
              href={`/recipes/${r.id}`}
              className="group flex items-center gap-4 py-4 transition-colors duration-150 hover:bg-[#F0F0EE] -mx-2 px-2 rounded"
            >
              {r.thumbnailUrl ? (
                <Image
                  src={r.thumbnailUrl}
                  alt={r.title}
                  width={96}
                  height={96}
                  className="h-12 w-12 shrink-0 object-cover rounded"
                />
              ) : (
                <div className="h-12 w-12 shrink-0 rounded bg-[#F0F0EE]" />
              )}
              <span className="flex flex-1 items-center justify-between text-left">
                <span className="font-medium text-[#1A1A1E] text-[15px]">{r.title}</span>
                <span className="text-xs text-[#8E8E93] transition group-hover:text-[#1A1A1E]">
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
