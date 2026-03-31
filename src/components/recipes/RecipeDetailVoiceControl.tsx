"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Props = {
  recipeId: string;
};

type SpeechRecognitionCtor = new () => {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: unknown) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

export function RecipeDetailVoiceControl({ recipeId }: Props) {
  const router = useRouter();
  const [listening, setListening] = useState(false);
  const [voiceHint, setVoiceHint] = useState<string | null>(null);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);
  const keepListeningRef = useRef(false);

  useEffect(() => {
    return () => {
      keepListeningRef.current = false;
      recognitionRef.current?.stop();
      recognitionRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let timer = 0;
    try {
      const carry = sessionStorage.getItem("voiceRecipeCarry");
      if (carry === "1") {
        // Small delay avoids microphone handover race from previous page.
        timer = window.setTimeout(() => toggleVoice(true), 300);
      }
    } catch {
      // ignore storage errors
    }
    return () => {
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  const runCommand = (raw: string): boolean => {
    const t = raw.toLowerCase();
    if (
      t.includes("start cooking mode") ||
      t.includes("start cooking") ||
      t.includes("cook mode")
    ) {
      router.push(`/cook/${recipeId}`);
      return true;
    }
    if (t.includes("ingredients")) {
      location.hash = "ingredients";
      return true;
    }
    if (t.includes("step") || t.includes("steps")) {
      location.hash = "steps";
      return true;
    }
    return false;
  };

  const toggleVoice = (forceStart = false) => {
    if (typeof window === "undefined") return;
    if (listening && !forceStart) {
      keepListeningRef.current = false;
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
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    const Ctor = maybe.SpeechRecognition ?? maybe.webkitSpeechRecognition;
    if (!Ctor) {
      setVoiceHint("Voice control is not supported in this browser.");
      return;
    }

    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = "en-US";

    rec.onresult = (event: unknown) => {
      const e = event as {
        resultIndex?: number;
        results?: ArrayLike<
          ArrayLike<{ transcript?: string }> & { isFinal?: boolean }
        >;
      };
      if (!e.results) return;
      const start = e.resultIndex ?? 0;
      for (let i = start; i < e.results.length; i++) {
        const r = e.results[i];
        if (!r?.isFinal) continue;
        const chunk = r?.[0]?.transcript?.trim();
        if (!chunk) continue;
        if (runCommand(chunk)) {
          setVoiceHint(`Heard command: "${chunk}"`);
        }
      }
    };

    rec.onerror = () => {
      keepListeningRef.current = false;
      recognitionRef.current = null;
      setListening(false);
      setVoiceHint("Microphone access failed. Check permission and retry.");
    };

    rec.onend = () => {
      if (keepListeningRef.current) {
        try {
          rec.start();
          return;
        } catch {
          // fall through
        }
      }
      recognitionRef.current = null;
      setListening(false);
    };

    try {
      keepListeningRef.current = true;
      recognitionRef.current = rec;
      setListening(true);
      try {
        sessionStorage.setItem("voiceRecipeCarry", "1");
      } catch {
        // ignore storage errors
      }
      setVoiceHint(
        "Voice on: say start cooking mode, ingredients, or step.",
      );
      rec.start();
    } catch {
      keepListeningRef.current = false;
      recognitionRef.current = null;
      setListening(false);
      setVoiceHint("Could not start voice input.");
    }
  };

  return (
    <div className="flex flex-col items-start gap-2">
      <p className="text-xs text-[var(--muted)]">
        Voice commands: <strong>start cooking mode</strong>, <strong>ingredients</strong>,{" "}
        <strong>step</strong>.
      </p>
      <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => toggleVoice(false)}
        aria-label="Voice commands"
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-colors duration-150 ${
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
      {voiceHint && <p className="text-xs text-[var(--muted)]">{voiceHint}</p>}
      </div>
    </div>
  );
}
