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
        <label className="flex flex-col gap-3 text-left text-sm text-[var(--muted)]">
          {showLabel ? "Search TheMealDB" : ""}
          <div className="flex items-center gap-3">
            {enableVoiceSearch && (
              <button
                type="button"
                onClick={startVoiceSearch}
                aria-label="Voice search"
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition-colors duration-150 ${
                  listening
                    ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                    : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:border-[var(--fg)] hover:text-[var(--fg)]"
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
              className="min-w-0 flex-1 border-b border-[var(--border)] bg-transparent px-0 py-2.5 text-[15px] text-[var(--fg)] placeholder:text-[var(--muted)] focus:border-[var(--fg)] focus:outline-none transition-colors duration-150"
              autoComplete="off"
              aria-busy={loading}
            />
          </div>
        </label>
        {enableVoiceSearch && voiceHint && (
          <p className="text-xs text-[var(--muted)]">{voiceHint}</p>
        )}
        {showDebounceHint && (
          <p className="text-xs text-[var(--muted)]">
            Results appear as you type with a short delay.
          </p>
        )}
      </div>

      {loading && (
        <p className="text-sm text-[var(--muted)]">Searching…</p>
      )}

      {error && (
        <p className="border-l-2 border-red-400 pl-3 text-sm text-red-500">
          {error}
        </p>
      )}

      {showEmptyHint && (
        <p className="text-sm text-[var(--muted)]">
          No recipes found. Try another keyword.
        </p>
      )}

      <ul className="divide-y divide-[var(--border)]">
        {recipes.map((r) => (
          <li key={r.id}>
            <Link
              href={`/recipes/${r.id}`}
              className="group -mx-2 flex items-center gap-4 rounded px-2 py-4 transition-colors duration-150 hover:bg-[var(--hover-bg)]"
            >
              {r.thumbnailUrl ? (
                <Image
                  src={r.thumbnailUrl}
                  alt={r.title}
                  width={96}
                  height={96}
                  className="h-12 w-12 shrink-0 rounded object-cover"
                />
              ) : (
                <div className="h-12 w-12 shrink-0 rounded bg-[var(--hover-bg)]" />
              )}
              <span className="flex flex-1 items-center justify-between text-left">
                <span className="text-[15px] font-medium text-[var(--fg)]">{r.title}</span>
                <span className="text-xs text-[var(--muted)] transition group-hover:text-[var(--fg)]">
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
