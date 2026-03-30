"use client";

import { CalibrationDots } from "@/components/eye-tracking/CalibrationDots";
import { CALIBRATION_POINTS } from "@/constants/eyeCalibration";
import { useGazeDwell } from "@/hooks/useGazeDwell";
import { useWebGazerSession } from "@/hooks/useWebGazerSession";
import type { RecipeDetail } from "@/types/recipe";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/** Longer dwell + padding helps noisy webcam gaze. */
const DWELL_MS = 1500;
const COOLDOWN_MS = 2000;
const GAZE_SMOOTH_ALPHA = 0.15;
const HIT_PADDING_PX = 36;

type CookPhase = "ingredients" | "steps";

type Props = { recipe: RecipeDetail };
type VoiceAction = "start" | "next" | "prev" | "ingredients" | "repeat";

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

export function RecipeCookClient({ recipe }: Props) {
  const steps = useMemo(
    () => (recipe.steps.length > 0 ? recipe.steps : ["No steps available."]),
    [recipe.steps],
  );
  const [cookPhase, setCookPhase] = useState<CookPhase>("steps");
  const [index, setIndex] = useState(0);
  const [showGuide, setShowGuide] = useState(true);
  const step = steps[index];
  const total = steps.length;

  const startHitRef = useRef<HTMLDivElement>(null);
  const prevZoneRef = useRef<HTMLDivElement>(null);
  const nextZoneRef = useRef<HTMLDivElement>(null);

  const eye = useWebGazerSession({
    showPredictionPointsWhileTracking: true,
  });

  const [dwellFlash, setDwellFlash] = useState<string | null>(null);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [lastHeard, setLastHeard] = useState<string | null>(null);
  const recognitionRef = useRef<{
    stop: () => void;
  } | null>(null);

  const speakText = useCallback((text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setVoiceError("Speech output is not available in this browser.");
      return;
    }
    const synth = window.speechSynthesis;
    setVoiceError(null);
    if (synth.speaking || synth.pending) {
      synth.cancel();
    }
    synth.resume();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 0.95;
    utterance.volume = 1;

    const voices = synth.getVoices();
    const preferred =
      voices.find((v) => v.lang?.toLowerCase().startsWith("en")) ?? voices[0];
    if (preferred) {
      utterance.voice = preferred;
    }

    let started = false;
    let ended = false;
    let watchdog = 0;
    utterance.onstart = () => {
      started = true;
      setVoiceError(null);
    };
    utterance.onend = () => {
      ended = true;
      if (watchdog) window.clearTimeout(watchdog);
      setVoiceError(null);
    };
    utterance.onerror = (event) => {
      const e = event as unknown as { error?: string };
      // Ignore benign interruption errors from cancel/restart races.
      if (e.error === "interrupted" || e.error === "canceled") return;
      if (watchdog) window.clearTimeout(watchdog);
      setVoiceError(
        "Voice output failed. Check tab mute, system output device, and browser sound permission.",
      );
    };

    // Speaking in next task improves reliability after recognition callbacks.
    window.setTimeout(() => {
      synth.speak(utterance);
      watchdog = window.setTimeout(() => {
        if (!started && !ended) {
          setVoiceError(
            "Voice output did not start. Try clicking 'Test voice output' again in this tab.",
          );
        }
      }, 2200);
    }, 60);
  }, []);

  const runAction = useCallback(
    (action: VoiceAction | "start" | "next" | "prev") => {
      if (action === "start") {
        setCookPhase("steps");
        setIndex(0);
        setDwellFlash("start");
      } else if (action === "next") {
        setIndex((i) => Math.min(total - 1, i + 1));
        setDwellFlash("next");
      } else if (action === "prev") {
        setIndex((i) => Math.max(0, i - 1));
        setDwellFlash("prev");
      } else if (action === "ingredients") {
        setCookPhase("ingredients");
      } else if (action === "repeat") {
        const text =
          cookPhase === "steps"
            ? `Step ${index + 1}. ${step}`
            : `Ingredients view for ${recipe.title}. Say start cooking to begin steps.`;
        speakText(text);
      }
      window.setTimeout(() => setDwellFlash(null), 600);
    },
    [cookPhase, index, recipe.title, speakText, step, total],
  );

  const onGazeActivate = useCallback(
    (id: string) => {
      if (id === "start" || id === "next" || id === "prev") {
        runAction(id);
      }
    },
    [runAction],
  );

  const gazeRegions = useMemo(() => {
    if (cookPhase === "ingredients") {
      return [{ id: "start", ref: startHitRef, active: true }];
    }
    return [
      { id: "prev", ref: prevZoneRef, active: index > 0 },
      { id: "next", ref: nextZoneRef, active: index < total - 1 },
    ];
  }, [cookPhase, index, total]);

  useGazeDwell({
    gazeRef: eye.gazeRef,
    enabled: eye.phase === "tracking" && !showGuide,
    regions: gazeRegions,
    dwellMs: DWELL_MS,
    cooldownMs: COOLDOWN_MS,
    onActivate: onGazeActivate,
    resetKey: `${cookPhase}-${index}`,
    hitPaddingPx: HIT_PADDING_PX,
    smoothAlpha: GAZE_SMOOTH_ALPHA,
  });

  const showIngredients = cookPhase === "ingredients";

  const parseVoiceAction = useCallback((text: string): VoiceAction | null => {
    const t = text.toLowerCase();
    if (
      t.includes("next") ||
      t.includes("forward") ||
      t.includes("continue")
    ) {
      return "next";
    }
    if (t.includes("previous") || t.includes("back")) {
      return "prev";
    }
    if (
      t.includes("start cooking") ||
      t.includes("start") ||
      t.includes("cook now")
    ) {
      return "start";
    }
    if (t.includes("ingredients")) {
      return "ingredients";
    }
    if (t.includes("repeat") || t.includes("read")) {
      return "repeat";
    }
    return null;
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const maybe = window as unknown as {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    const Ctor = maybe.SpeechRecognition ?? maybe.webkitSpeechRecognition;
    setVoiceSupported(Boolean(Ctor));
  }, []);

  useEffect(() => {
    if (!voiceEnabled) {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
      return;
    }
    if (typeof window === "undefined") return;
    const maybe = window as unknown as {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    const Ctor = maybe.SpeechRecognition ?? maybe.webkitSpeechRecognition;
    if (!Ctor) {
      setVoiceError("Voice recognition is not supported in this browser.");
      setVoiceEnabled(false);
      return;
    }

    setVoiceError(null);
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = "en-US";
    rec.onresult = (event: unknown) => {
      const e = event as {
        results?: ArrayLike<ArrayLike<{ transcript?: string }>>;
      };
      const chunk = e.results?.[e.results.length - 1]?.[0]?.transcript;
      if (!chunk) return;
      setLastHeard(chunk);
      const action = parseVoiceAction(chunk);
      if (action) runAction(action);
    };
    rec.onerror = () => {
      setVoiceError("Microphone error. Check permission and try again.");
    };
    rec.onend = () => {
      // Keep listening while toggle is ON.
      if (voiceEnabled) {
        try {
          rec.start();
        } catch {
          /* ignore restart race */
        }
      }
    };

    try {
      rec.start();
      recognitionRef.current = rec;
    } catch {
      setVoiceError("Could not start voice recognition.");
      setVoiceEnabled(false);
    }

    return () => {
      rec.onend = null;
      rec.stop();
      if (recognitionRef.current === rec) {
        recognitionRef.current = null;
      }
    };
  }, [parseVoiceAction, runAction, voiceEnabled]);

  return (
    <div className="relative flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-4 sm:px-8">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-widest text-cyan-400/90">
            Cooking mode
          </p>
          <h1 className="truncate text-lg font-semibold text-white sm:text-xl">
            {recipe.title}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {eye.phase === "idle" && (
            <button
              type="button"
              onClick={() => void eye.start()}
              className="rounded-full bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/25 hover:bg-cyan-400"
            >
              Enable eye tracking
            </button>
          )}
          {eye.phase === "loading" && (
            <span className="text-xs text-slate-400">Starting camera…</span>
          )}
          {eye.phase === "tracking" && (
            <>
              <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
                Gaze smoothed · dwell ~{Math.round(DWELL_MS / 100) / 10}s
              </span>
              <button
                type="button"
                onClick={() => void eye.recalibrate()}
                className="rounded-full border border-white/20 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/10"
              >
                Recalibrate
              </button>
              <button
                type="button"
                onClick={() => void eye.stop()}
                className="rounded-full border border-white/20 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/10"
              >
                Turn off
              </button>
            </>
          )}
          {voiceSupported && (
            <button
              type="button"
              onClick={() => setVoiceEnabled((v) => !v)}
              className={`rounded-full border px-3 py-1.5 text-xs ${
                voiceEnabled
                  ? "border-violet-400/50 bg-violet-500/15 text-violet-200"
                  : "border-white/20 text-slate-200 hover:bg-white/10"
              }`}
            >
              {voiceEnabled ? "Voice on" : "Enable voice"}
            </button>
          )}
          <Link
            href={`/recipes/${recipe.id}`}
            className="rounded-full border border-white/20 px-4 py-2 text-sm text-slate-200 hover:bg-white/10"
          >
            Recipe details
          </Link>
          <Link
            href="/recipes"
            className="rounded-full border border-white/20 px-4 py-2 text-sm text-slate-200 hover:bg-white/10"
          >
            All recipes
          </Link>
        </div>
      </header>

      {eye.phase === "error" && eye.error && (
        <div className="mx-4 mt-4 rounded-xl border border-red-500/30 bg-red-950/50 px-4 py-3 text-sm text-red-100 sm:mx-8">
          <p>{eye.error}</p>
          <button
            type="button"
            className="mt-2 rounded-full border border-white/20 px-3 py-1 text-xs text-white hover:bg-white/10"
            onClick={() => {
              eye.setPhase("idle");
              void eye.cleanupWebGazer();
            }}
          >
            Dismiss
          </button>
        </div>
      )}
      {voiceError && (
        <div className="mx-4 mt-4 rounded-xl border border-amber-500/30 bg-amber-950/40 px-4 py-3 text-sm text-amber-100 sm:mx-8">
          {voiceError}
        </div>
      )}

      {eye.phase === "calibrating" && (
        <div className="fixed inset-0 z-[100000] flex flex-col items-center bg-slate-950/55 px-4 pt-16 backdrop-blur-[2px]">
          <p className="mb-2 max-w-md text-center text-sm text-slate-200">
            Keep your face in the <strong className="text-white">camera preview</strong>{" "}
            (bottom-left). Look at each dot and click it ({eye.calibrationIndex + 1}/
            {CALIBRATION_POINTS.length}). Then use gaze on{" "}
            <strong className="text-white">Start cooking</strong> and{" "}
            <strong className="text-white">Next step</strong>.
          </p>
          <CalibrationDots
            calibrationIndex={eye.calibrationIndex}
            onPointClick={eye.onCalibrationClick}
          />
        </div>
      )}

      {showGuide && (
        <div className="fixed inset-0 z-[100120] flex items-center justify-center bg-slate-950/80 px-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl border border-white/15 bg-slate-900/95 p-6 text-slate-100 shadow-2xl shadow-black/50 sm:p-8">
            <h2 className="text-xl font-semibold text-white sm:text-2xl">
              Hands-free controls
            </h2>
            <p className="mt-3 text-sm text-slate-300">
              You can use eye tracking, voice control, or both at the same time.
            </p>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-cyan-500/25 bg-cyan-500/10 p-4">
                <p className="text-sm font-semibold text-cyan-200">Eye tracking</p>
                <p className="mt-2 text-xs text-slate-300">
                  Enable eye tracking to calibrate. In step mode, look at the
                  bottom-right zone for Next and bottom-left for Previous.
                </p>
              </div>
              <div className="rounded-xl border border-violet-500/25 bg-violet-500/10 p-4">
                <p className="text-sm font-semibold text-violet-200">Voice commands</p>
                <ul className="mt-2 space-y-1 text-xs text-slate-300">
                  <li>
                    <strong>next / forward / continue</strong> → go to next step
                  </li>
                  <li>
                    <strong>previous / back</strong> → go to previous step
                  </li>
                  <li>
                    <strong>start cooking</strong> → jump to step 1
                  </li>
                  <li>
                    <strong>ingredients</strong> → open ingredients screen
                  </li>
                  <li>
                    <strong>repeat / read</strong> → read current step aloud
                  </li>
                </ul>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  setCookPhase("steps");
                  setIndex(0);
                  setShowGuide(false);
                }}
                className="rounded-full bg-cyan-500 px-6 py-2.5 text-sm font-semibold text-slate-950 hover:bg-cyan-400"
              >
                Start cooking now
              </button>
              <button
                type="button"
                onClick={() => {
                  setCookPhase("ingredients");
                  setShowGuide(false);
                }}
                className="rounded-full border border-white/20 px-6 py-2.5 text-sm text-slate-200 hover:bg-white/10"
              >
                Review ingredients first
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="flex flex-1 flex-col justify-center px-4 py-10 sm:px-10">
        {showIngredients ? (
          <>
            <h2 className="mb-6 text-center text-lg font-semibold text-white sm:text-xl">
              Ingredients
            </h2>
            {recipe.ingredients.length > 0 ? (
              <ul className="mx-auto grid max-w-2xl gap-2 sm:grid-cols-2">
                {recipe.ingredients.map((ing) => (
                  <li
                    key={`${ing.name}-${ing.measure}`}
                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left text-slate-200"
                  >
                    <span className="font-medium text-white">{ing.name}</span>
                    {ing.measure ? (
                      <span className="text-slate-400"> · {ing.measure}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mx-auto max-w-md text-center text-sm text-slate-500">
                No ingredient list for this recipe in TheMealDB—you can still
                start the steps.
              </p>
            )}
            {eye.phase === "tracking" && (
              <p className="mx-auto mt-10 max-w-lg text-center text-xs text-slate-500">
                Look at <strong className="text-slate-400">Start cooking</strong>{" "}
                for ~{Math.round(DWELL_MS / 100) / 10}s to begin (or tap the
                button). Gaze is smoothed so the red dot moves more steadily.
                {voiceEnabled &&
                  " You can also say: start cooking, next, previous, ingredients, repeat."}
              </p>
            )}
          </>
        ) : (
          <>
            <p className="mb-6 text-center text-sm text-slate-500">
              Step {index + 1} of {total}
            </p>
            <p className="mx-auto max-w-3xl text-center text-2xl font-medium leading-relaxed tracking-tight text-white sm:text-3xl md:text-4xl">
              {step}
            </p>
            <button
              type="button"
              onClick={() => setCookPhase("ingredients")}
              className="mx-auto mt-10 text-sm text-cyan-400/90 underline-offset-4 hover:text-cyan-300 hover:underline"
            >
              Back to ingredients
            </button>
            {eye.phase === "tracking" && (
              <p className="mx-auto mt-6 max-w-lg text-center text-xs text-slate-500">
                In step mode, gaze at the{" "}
                <strong className="text-slate-400">bottom-right third</strong> for
                Next, or <strong className="text-slate-400">bottom-left third</strong>{" "}
                for Previous (~{Math.round(DWELL_MS / 100) / 10}s).
                {voiceEnabled &&
                  " Voice commands: next, previous, ingredients, repeat."}
              </p>
            )}
            {voiceEnabled && lastHeard && (
              <p className="mx-auto mt-2 max-w-lg text-center text-[11px] text-violet-300/80">
                Heard: "{lastHeard}"
              </p>
            )}
          </>
        )}
      </main>

      {!showIngredients && eye.phase === "tracking" && !showGuide && (
        <>
          <div
            ref={prevZoneRef}
            className={`pointer-events-none fixed bottom-0 left-0 z-10 h-[53%] w-[42%] rounded-tr-3xl border-t border-r transition ${
              dwellFlash === "prev"
                ? "border-cyan-400/70 bg-cyan-500/10"
                : "border-cyan-500/35 bg-cyan-500/5"
            }`}
            aria-hidden="true"
          />
          <div
            ref={nextZoneRef}
            className={`pointer-events-none fixed right-0 bottom-0 z-10 h-[53%] w-[42%] rounded-tl-3xl border-t border-l transition ${
              dwellFlash === "next"
                ? "border-cyan-400/70 bg-cyan-500/10"
                : "border-cyan-500/35 bg-cyan-500/5"
            }`}
            aria-hidden="true"
          />
        </>
      )}

      <footer className="border-t border-white/10 px-4 py-8 sm:px-8">
        <div className="mx-auto flex max-w-3xl flex-wrap justify-center gap-6">
          {showIngredients ? (
            <div
              ref={startHitRef}
              className={`flex min-h-[6rem] min-w-[min(100%,20rem)] items-center justify-center rounded-3xl border-2 border-dashed border-transparent p-6 transition ${
                dwellFlash === "start"
                  ? "border-cyan-400/60 bg-cyan-500/10"
                  : ""
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  setCookPhase("steps");
                  setIndex(0);
                }}
                className="min-h-[3.75rem] min-w-[16rem] rounded-full bg-cyan-500 px-10 py-4 text-lg font-semibold text-slate-950 shadow-lg shadow-cyan-500/30 transition hover:bg-cyan-400"
              >
                Start cooking
              </button>
            </div>
          ) : (
            <>
              <div
                className={`flex min-h-[6rem] min-w-[12rem] items-center justify-center rounded-3xl border-2 border-dashed border-transparent p-4 transition ${
                  dwellFlash === "prev"
                    ? "border-cyan-400/60 bg-cyan-500/10"
                    : ""
                }`}
              >
                <button
                  type="button"
                  disabled={index <= 0}
                  onClick={() => setIndex((i) => Math.max(0, i - 1))}
                  className={`min-h-[3.5rem] min-w-[11rem] rounded-full border-2 px-8 py-4 text-base font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
                    dwellFlash === "prev"
                      ? "border-cyan-400 bg-cyan-500/20 text-cyan-100"
                      : "border-white/25 text-white hover:bg-white/10"
                  }`}
                >
                  Previous
                </button>
              </div>
              <div
                className={`flex min-h-[6rem] min-w-[12rem] items-center justify-center rounded-3xl border-2 border-dashed border-transparent p-4 transition ${
                  dwellFlash === "next"
                    ? "border-cyan-400/60 bg-cyan-500/10"
                    : ""
                }`}
              >
                <button
                  type="button"
                  disabled={index >= total - 1}
                  onClick={() => setIndex((i) => Math.min(total - 1, i + 1))}
                  className={`min-h-[3.75rem] min-w-[14rem] rounded-full px-10 py-4 text-lg font-semibold shadow-lg transition disabled:cursor-not-allowed disabled:opacity-40 ${
                    dwellFlash === "next"
                      ? "bg-cyan-300 text-slate-950 shadow-cyan-400/40"
                      : "bg-cyan-500 text-slate-950 shadow-cyan-500/25 hover:bg-cyan-400"
                  }`}
                >
                  Next step
                </button>
              </div>
            </>
          )}
        </div>
      </footer>
    </div>
  );
}
