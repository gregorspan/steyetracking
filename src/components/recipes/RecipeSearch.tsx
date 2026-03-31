"use client";

import type { RecipeSummary } from "@/types/recipe";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const DEBOUNCE_MS = 250;

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
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [recipes, setRecipes] = useState<RecipeSummary[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [voiceHint, setVoiceHint] = useState<string | null>(null);
  const recognitionRef = useRef<{
    stop: () => void;
  } | null>(null);
  const recipesRef = useRef<RecipeSummary[]>([]);
  const selectedIndexRef = useRef(0);
  const shouldKeepListeningRef = useRef(false);

  useEffect(() => {
    setSelectedIndex((i) => {
      if (recipes.length === 0) return 0;
      return Math.min(i, recipes.length - 1);
    });
  }, [recipes]);

  useEffect(() => {
    recipesRef.current = recipes;
  }, [recipes]);

  useEffect(() => {
    selectedIndexRef.current = selectedIndex;
  }, [selectedIndex]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
    };
  }, []);

  const openSelectedRecipe = () => {
    const list = recipesRef.current;
    const idx = selectedIndexRef.current;
    const picked = list[idx];
    if (!picked) return;
    // Release microphone on the search page before navigating.
    shouldKeepListeningRef.current = false;
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setListening(false);
    try {
      sessionStorage.setItem("voiceRecipeCarry", "1");
    } catch {
      // ignore storage errors
    }
    router.push(`/recipes/${picked.id}`);
  };

  const applyVoiceCommand = (raw: string): boolean => {
    const t = raw.toLowerCase();
    const count = recipesRef.current.length;
    if (t.includes("down") || t.includes("next recipe")) {
      if (count <= 1) return true;
      setSelectedIndex((i) => Math.min(count - 1, i + 1));
      return true;
    }
    if (t.includes("up") || t.includes("previous recipe")) {
      if (count <= 1) return true;
      setSelectedIndex((i) => Math.max(0, i - 1));
      return true;
    }
    if (t.includes("open") || t === "start") {
      openSelectedRecipe();
      return true;
    }
    return false;
  };

  const normalizeVoiceQuery = (raw: string): string => {
    const words = raw
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
    if (words.length <= 1) return raw.trim();
    const allSame = words.every((w) => w === words[0]);
    if (allSame) return words[0];
    return raw.trim();
  };

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
    if (listening) {
      shouldKeepListeningRef.current = false;
      recognitionRef.current?.stop();
      recognitionRef.current = null;
      setListening(false);
      setVoiceHint("Voice control stopped.");
      try {
        sessionStorage.removeItem("voiceRecipeCarry");
      } catch {
        // ignore storage errors
      }
      return;
    }
    const maybe = window as unknown as {
      SpeechRecognition?: new () => {
        lang: string;
        interimResults: boolean;
        continuous: boolean;
        onresult: ((event: unknown) => void) | null;
        onerror: ((event: unknown) => void) | null;
        onend: (() => void) | null;
        start: () => void;
        stop: () => void;
      };
      webkitSpeechRecognition?: new () => {
        lang: string;
        interimResults: boolean;
        continuous: boolean;
        onresult: ((event: unknown) => void) | null;
        onerror: ((event: unknown) => void) | null;
        onend: (() => void) | null;
        start: () => void;
        stop: () => void;
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
    rec.interimResults = false;
    rec.continuous = true;
    rec.onresult = (event: unknown) => {
      const e = event as {
        resultIndex?: number;
        results?: ArrayLike<
          ArrayLike<{ transcript?: string }> & { isFinal?: boolean }
        >;
      };
      if (!e.results) return;
      const startIdx = e.resultIndex ?? 0;
      for (let i = startIdx; i < e.results.length; i++) {
        const result = e.results[i];
        if (!result?.isFinal) continue;
        const chunk = result?.[0]?.transcript?.trim();
        if (!chunk) continue;
        if (applyVoiceCommand(chunk)) {
          setVoiceHint(`Heard command: "${chunk}"`);
          continue;
        }
        const normalized = normalizeVoiceQuery(chunk);
        setQuery((prev) => (prev.toLowerCase() === normalized.toLowerCase() ? prev : normalized));
        setVoiceHint(`Searching: "${normalized}"`);
      }
    };
    rec.onerror = () => {
      setVoiceHint("Mic access failed. Check permission and try again.");
      recognitionRef.current = null;
      setListening(false);
      shouldKeepListeningRef.current = false;
    };
    rec.onend = () => {
      if (shouldKeepListeningRef.current) {
        try {
          rec.start();
          return;
        } catch {
          // fall through to disabled state
        }
      }
      recognitionRef.current = null;
      setListening(false);
    };
    try {
      setListening(true);
      shouldKeepListeningRef.current = true;
      try {
        sessionStorage.setItem("voiceRecipeCarry", "1");
      } catch {
        // ignore storage errors
      }
      setVoiceHint(
        "Voice control on: say a query, then up/down, open, or start.",
      );
      recognitionRef.current = rec;
      rec.start();
    } catch {
      recognitionRef.current = null;
      setListening(false);
      try {
        sessionStorage.removeItem("voiceRecipeCarry");
      } catch {
        // ignore storage errors
      }
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
        {recipes.map((r, i) => (
          <li key={r.id}>
            <Link
              href={`/recipes/${r.id}`}
              className={`group -mx-2 flex items-center gap-4 rounded px-2 py-4 transition-colors duration-150 hover:bg-[var(--hover-bg)] ${
                i === selectedIndex
                  ? "border-l-2 border-[var(--accent)] bg-[var(--hover-bg)]"
                  : ""
              }`}
              aria-current={i === selectedIndex ? "true" : undefined}
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
