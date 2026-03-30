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
const VOICE_ACTION_COOLDOWN_MS = 700;

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
  const [showGazeDot, setShowGazeDot] = useState(true);

  const eye = useWebGazerSession({
    showPredictionPointsWhileTracking: showGazeDot,
  });

  const [dwellFlash, setDwellFlash] = useState<string | null>(null);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [lastHeard, setLastHeard] = useState<string | null>(null);
  const [postCalibHint, setPostCalibHint] = useState(false);
  const [showZoneHint, setShowZoneHint] = useState(false);
  const [voiceHelpHint, setVoiceHelpHint] = useState(false);
  const [isSpeakingOutLoud, setIsSpeakingOutLoud] = useState(false);
  const recognitionRef = useRef<{
    stop: () => void;
  } | null>(null);
  const lastVoiceActionMsRef = useRef(0);
  const prevEyePhaseRef = useRef(eye.phase);
  const isSpeakingRef = useRef(false);

  const speakText = useCallback((text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setVoiceError("Speech output is not available in this browser.");
      return;
    }
    const synth = window.speechSynthesis;
    setVoiceError(null);
    // Gate recognition immediately to avoid "read read" echoes before onstart fires.
    isSpeakingRef.current = true;
    setIsSpeakingOutLoud(true);
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
      isSpeakingRef.current = true;
      setIsSpeakingOutLoud(true);
      setVoiceError(null);
    };
    utterance.onend = () => {
      ended = true;
      if (watchdog) window.clearTimeout(watchdog);
      isSpeakingRef.current = false;
      setIsSpeakingOutLoud(false);
      setVoiceError(null);
    };
    utterance.onerror = (event) => {
      const e = event as unknown as { error?: string };
      // Ignore benign interruption errors from cancel/restart races.
      if (e.error === "interrupted" || e.error === "canceled") return;
      if (watchdog) window.clearTimeout(watchdog);
      isSpeakingRef.current = false;
      setIsSpeakingOutLoud(false);
      setVoiceError(
        "Voice output failed. Check tab mute, system output device, and browser sound permission.",
      );
    };

    synth.speak(utterance);
    watchdog = window.setTimeout(() => {
      if (!started && !ended) {
        isSpeakingRef.current = false;
        setIsSpeakingOutLoud(false);
        setVoiceError(
          "Voice output did not start. Check browser/tab audio permissions.",
        );
      }
    }, 1200);
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
    rec.interimResults = true;
    rec.lang = "en-US";
    rec.onresult = (event: unknown) => {
      if (isSpeakingRef.current) return;
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
        const chunk = result?.[0]?.transcript?.trim();
        if (!chunk) continue;
        setLastHeard(chunk);
        const action = parseVoiceAction(chunk);
        if (!action) continue;
        const now = performance.now();
        if (now - lastVoiceActionMsRef.current < VOICE_ACTION_COOLDOWN_MS) {
          continue;
        }
        lastVoiceActionMsRef.current = now;
        runAction(action);
        // If this result is final, stop scanning this event batch.
        if (result.isFinal) break;
      }
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

  useEffect(() => {
    if (prevEyePhaseRef.current === "calibrating" && eye.phase === "tracking") {
      setPostCalibHint(true);
      setShowZoneHint(true);
      const t = window.setTimeout(() => {
        setPostCalibHint(false);
        setShowZoneHint(false);
      }, 5250);
      prevEyePhaseRef.current = eye.phase;
      return () => clearTimeout(t);
    }
    prevEyePhaseRef.current = eye.phase;
  }, [eye.phase]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const applyDotVisibility = () => {
      const dot = document.getElementById("webgazerGazeDot");
      if (!dot) return;
      const shouldShow = eye.phase === "tracking" && showGazeDot;
      dot.style.display = shouldShow ? "block" : "none";
      dot.style.visibility = shouldShow ? "visible" : "hidden";
      dot.style.opacity = shouldShow ? "1" : "0";
    };
    applyDotVisibility();
    const i = window.setInterval(applyDotVisibility, 500);
    return () => clearInterval(i);
  }, [showGazeDot, eye.phase]);

  useEffect(() => {
    if (!voiceEnabled) {
      setVoiceHelpHint(false);
      return;
    }
    setVoiceHelpHint(true);
    const t = window.setTimeout(() => setVoiceHelpHint(false), 6000);
    return () => clearTimeout(t);
  }, [voiceEnabled]);

  return (
    <div className="relative flex min-h-screen flex-col bg-[#FAFAF9] text-[#1A1A1E]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E5E5E3] bg-[#FAFAF9] px-4 py-4 sm:px-8">
        <div className="min-w-0">
          <p className="text-xs font-medium text-[#8E8E93]">
            Cooking mode
          </p>
          <h1
            className="truncate text-lg font-semibold text-[#1A1A1E] sm:text-xl"
            style={{ letterSpacing: "-0.01em" }}
          >
            {recipe.title}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {eye.phase === "idle" && (
            <button
              type="button"
              onClick={() => void eye.start()}
              className="rounded-full bg-[#1A1A1E] px-5 py-2 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#333]"
            >
              Enable eye tracking
            </button>
          )}
          {eye.phase === "loading" && (
            <span className="text-xs text-[#8E8E93]">Starting camera…</span>
          )}
          {eye.phase === "tracking" && (
            <>
              <span className="rounded px-3 py-1 text-xs font-medium text-[#E8850A] border border-[#E8850A]/30 bg-[#E8850A]/5">
                Gaze active · dwell ~{Math.round(DWELL_MS / 100) / 10}s
              </span>
              <button
                type="button"
                onClick={() => setShowGazeDot((v) => !v)}
                className="rounded px-3 py-1.5 text-xs text-[#8E8E93] border border-[#E5E5E3] transition-colors duration-150 hover:bg-[#F0F0EE] hover:text-[#1A1A1E]"
              >
                {showGazeDot ? "Hide dot" : "Show dot"}
              </button>
              <button
                type="button"
                onClick={() => void eye.recalibrate()}
                className="rounded px-3 py-1.5 text-xs text-[#8E8E93] border border-[#E5E5E3] transition-colors duration-150 hover:bg-[#F0F0EE] hover:text-[#1A1A1E]"
              >
                Recalibrate
              </button>
              <button
                type="button"
                onClick={() => void eye.stop()}
                className="rounded px-3 py-1.5 text-xs text-[#8E8E93] border border-[#E5E5E3] transition-colors duration-150 hover:bg-[#F0F0EE] hover:text-[#1A1A1E]"
              >
                Turn off
              </button>
            </>
          )}
          {voiceSupported && (
            <button
              type="button"
              onClick={() => setVoiceEnabled((v) => !v)}
              className={`rounded-full px-5 py-2 text-sm font-semibold transition-colors duration-150 ${
                voiceEnabled
                  ? "bg-[#E8850A] text-white hover:bg-[#d4780a]"
                  : "border border-[#E5E5E3] text-[#1A1A1E] hover:bg-[#F0F0EE]"
              }`}
            >
              {voiceEnabled ? "Voice on" : "Enable voice"}
            </button>
          )}
          <Link
            href={`/recipes/${recipe.id}`}
            className="rounded px-4 py-2 text-sm text-[#8E8E93] border border-[#E5E5E3] transition-colors duration-150 hover:bg-[#F0F0EE] hover:text-[#1A1A1E]"
          >
            Recipe details
          </Link>
          <Link
            href="/"
            className="rounded px-4 py-2 text-sm text-[#8E8E93] border border-[#E5E5E3] transition-colors duration-150 hover:bg-[#F0F0EE] hover:text-[#1A1A1E]"
          >
            Home
          </Link>
        </div>
      </header>

      {eye.phase === "error" && eye.error && (
        <div className="mx-4 mt-4 border-l-2 border-red-400 bg-red-50 px-4 py-3 text-sm text-red-700 sm:mx-8">
          <p>{eye.error}</p>
          <button
            type="button"
            className="mt-2 rounded px-3 py-1 text-xs text-red-600 border border-red-200 transition-colors duration-150 hover:bg-red-100"
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
        <div className="mx-4 mt-4 border-l-2 border-[#E8850A] bg-[#E8850A]/5 px-4 py-3 text-sm text-[#1A1A1E] sm:mx-8">
          {voiceError}
        </div>
      )}
      {postCalibHint && !showGuide && (
        <div className="fixed inset-0 z-[100130] flex items-start justify-center px-4 pt-[25vh] pointer-events-none">
          <div className="w-full max-w-xl border border-[#E5E5E3] bg-white/95 px-6 py-5 text-center text-[#1A1A1E] backdrop-blur-sm">
            <p className="text-xs font-semibold text-[#E8850A]">
              Calibration complete
            </p>
            <p className="mt-3 text-[15px] sm:text-base">
              Hold your gaze on the <strong className="text-[#E8850A]">right side</strong>{" "}
              (next) or <strong className="text-[#E8850A]">left side</strong> (back)
              for about <strong>{Math.round(DWELL_MS / 100) / 10}s</strong>.
            </p>
          </div>
        </div>
      )}
      {voiceHelpHint && !showGuide && (
        <div className="fixed inset-0 z-[100125] flex items-start justify-center px-4 pt-24 pointer-events-none">
          <div className="w-full max-w-md border border-[#E5E5E3] bg-white/95 px-5 py-4 text-sm text-[#1A1A1E] backdrop-blur-sm">
            <p className="text-xs font-semibold text-[#E8850A]">
              Voice quick tips
            </p>
            <p className="mt-2 text-[#8E8E93]">
              Say <strong className="text-[#1A1A1E]">next</strong>,{" "}
              <strong className="text-[#1A1A1E]">previous</strong>,{" "}
              <strong className="text-[#1A1A1E]">ingredients</strong>, or{" "}
              <strong className="text-[#1A1A1E]">repeat</strong>.
            </p>
          </div>
        </div>
      )}

      {eye.phase === "calibrating" && (
        <div className="fixed inset-0 z-[100000] flex flex-col items-center bg-[#FAFAF9]/80 px-4 pt-16 backdrop-blur-[2px]">
          <p className="mb-2 max-w-md text-center text-sm text-[#8E8E93]">
            Keep your face in the <strong className="text-[#1A1A1E]">camera preview</strong>{" "}
            (bottom-left). Look at each dot and click it ({eye.calibrationIndex + 1}/
            {CALIBRATION_POINTS.length}). Then use gaze on{" "}
            <strong className="text-[#1A1A1E]">Start cooking</strong> and{" "}
            <strong className="text-[#1A1A1E]">Next step</strong>.
          </p>
          <CalibrationDots
            calibrationIndex={eye.calibrationIndex}
            onPointClick={eye.onCalibrationClick}
          />
        </div>
      )}

      {showGuide && (
        <div className="fixed inset-0 z-[100120] flex items-center justify-center bg-[#FAFAF9]/92 px-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl border border-[#E5E5E3] bg-white p-6 sm:p-8">
            <h2
              className="text-xl font-semibold sm:text-2xl"
              style={{ letterSpacing: "-0.02em" }}
            >
              Hands-free controls
            </h2>
            <p className="mt-2 text-[15px] text-[#8E8E93]">
              You can use eye tracking, voice control, or both at the same time.
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="border border-[#E5E5E3] p-4">
                <p className="text-sm font-semibold text-[#1A1A1E]">Eye tracking</p>
                <p className="mt-2 text-xs text-[#8E8E93]">
                  Enable eye tracking to calibrate. In step mode, look at the right
                  zone for Next and left zone for Previous.
                </p>
              </div>
              <div className="border border-[#E5E5E3] p-4">
                <p className="text-sm font-semibold text-[#1A1A1E]">Voice commands</p>
                <ul className="mt-2 space-y-1 text-xs text-[#8E8E93]">
                  <li>
                    <strong className="text-[#1A1A1E]">next / forward / continue</strong> → go to next step
                  </li>
                  <li>
                    <strong className="text-[#1A1A1E]">previous / back</strong> → go to previous step
                  </li>
                  <li>
                    <strong className="text-[#1A1A1E]">start cooking</strong> → jump to step 1
                  </li>
                  <li>
                    <strong className="text-[#1A1A1E]">ingredients</strong> → open ingredients screen
                  </li>
                  <li>
                    <strong className="text-[#1A1A1E]">repeat / read</strong> → read current step aloud
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
                className="rounded-full bg-[#E8850A] px-6 py-2.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#d4780a]"
              >
                Start cooking now
              </button>
              <button
                type="button"
                onClick={() => {
                  setCookPhase("ingredients");
                  setShowGuide(false);
                }}
                className="rounded px-6 py-2.5 text-sm text-[#8E8E93] border border-[#E5E5E3] transition-colors duration-150 hover:bg-[#F0F0EE] hover:text-[#1A1A1E]"
              >
                Review ingredients first
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="flex flex-1 flex-col justify-center px-4 py-12 sm:px-10">
        {showIngredients ? (
          <>
            <h2
              className="mb-6 text-center text-lg font-semibold text-[#1A1A1E] sm:text-xl"
              style={{ letterSpacing: "-0.01em" }}
            >
              Ingredients
            </h2>
            {recipe.ingredients.length > 0 ? (
              <ul className="mx-auto grid max-w-2xl gap-0 sm:grid-cols-2">
                {recipe.ingredients.map((ing) => (
                  <li
                    key={`${ing.name}-${ing.measure}`}
                    className="border-b border-[#E5E5E3] px-4 py-3 text-left text-[15px]"
                  >
                    <span className="font-medium text-[#1A1A1E]">{ing.name}</span>
                    {ing.measure ? (
                      <span className="text-[#8E8E93]"> · {ing.measure}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mx-auto max-w-md text-center text-sm text-[#8E8E93]">
                No ingredient list for this recipe in TheMealDB—you can still
                start the steps.
              </p>
            )}
            {eye.phase === "tracking" && (
              <p className="mx-auto mt-10 max-w-lg text-center text-xs text-[#8E8E93]">
                Look at <strong className="text-[#E8850A]">Start cooking</strong>{" "}
                for ~{Math.round(DWELL_MS / 100) / 10}s to begin (or tap the
                button). Gaze is smoothed so the red dot moves more steadily.
                {voiceEnabled &&
                  " You can also say: start cooking, next, previous, ingredients, repeat."}
              </p>
            )}
          </>
        ) : (
          <>
            <p className="mb-6 text-center text-sm text-[#8E8E93]">
              Step {index + 1} of {total}
            </p>
            <p
              className="mx-auto max-w-3xl text-center text-2xl font-medium leading-relaxed text-[#1A1A1E] sm:text-3xl md:text-4xl"
              style={{ letterSpacing: "-0.01em" }}
            >
              {step}
            </p>
            <button
              type="button"
              onClick={() => setCookPhase("ingredients")}
              className="mx-auto mt-10 rounded px-5 py-2 text-sm text-[#8E8E93] border border-[#E5E5E3] transition-colors duration-150 hover:bg-[#F0F0EE] hover:text-[#1A1A1E]"
            >
              Back to ingredients
            </button>
            {eye.phase === "tracking" && (
              <p className="mx-auto mt-6 max-w-lg text-center text-xs text-[#8E8E93]">
                In step mode, gaze at the{" "}
                <strong className="text-[#E8850A]">right third</strong> for Next, or{" "}
                <strong className="text-[#E8850A]">left third</strong> for Previous
                (~{Math.round(DWELL_MS / 100) / 10}s).
                {voiceEnabled &&
                  " Voice commands: next, previous, ingredients, repeat."}
              </p>
            )}
            {voiceEnabled && lastHeard && !isSpeakingOutLoud && (
              <p className="mx-auto mt-2 max-w-lg text-center text-[11px] text-[#8E8E93]">
                Heard: &ldquo;{lastHeard}&rdquo;
              </p>
            )}
          </>
        )}
      </main>

      {!showIngredients && eye.phase === "tracking" && !showGuide && (
        <>
          <div
            ref={prevZoneRef}
            className={`pointer-events-none fixed top-16 bottom-0 left-0 z-10 w-1/3 border-r transition-all duration-200 ${
              dwellFlash === "prev"
                ? "border-[#E8850A]/50 bg-[#E8850A]/8"
                : showZoneHint
                  ? "border-[#E8850A]/20 bg-[#E8850A]/3"
                  : "border-transparent bg-transparent"
            }`}
            aria-hidden="true"
          />
          <div
            ref={nextZoneRef}
            className={`pointer-events-none fixed top-16 right-0 bottom-0 z-10 w-1/3 border-l transition-all duration-200 ${
              dwellFlash === "next"
                ? "border-[#E8850A]/50 bg-[#E8850A]/8"
                : showZoneHint
                  ? "border-[#E8850A]/20 bg-[#E8850A]/3"
                  : "border-transparent bg-transparent"
            }`}
            aria-hidden="true"
          />
        </>
      )}

      {!showIngredients && !showGuide && (
        <>
          <div className="fixed top-1/2 left-2 z-20 -translate-y-1/2 sm:left-4">
            <button
              type="button"
              aria-label="Previous step"
              disabled={index <= 0}
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              className={`group flex h-14 w-14 items-center justify-center rounded-full border-2 transition-colors duration-150 sm:h-16 sm:w-16 disabled:cursor-not-allowed disabled:opacity-30 ${
                dwellFlash === "prev"
                  ? "border-[#E8850A] bg-[#E8850A]/10 text-[#E8850A]"
                  : "border-[#E5E5E3] bg-white text-[#1A1A1E] hover:border-[#1A1A1E]"
              }`}
            >
              <span className="text-2xl leading-none">←</span>
            </button>
          </div>
          <div className="fixed top-1/2 right-2 z-20 -translate-y-1/2 sm:right-4">
            <button
              type="button"
              aria-label="Next step"
              disabled={index >= total - 1}
              onClick={() => setIndex((i) => Math.min(total - 1, i + 1))}
              className={`group flex h-14 w-14 items-center justify-center rounded-full border-2 transition-colors duration-150 sm:h-16 sm:w-16 disabled:cursor-not-allowed disabled:opacity-30 ${
                dwellFlash === "next"
                  ? "border-[#E8850A] bg-[#E8850A] text-white"
                  : "border-[#E5E5E3] bg-white text-[#1A1A1E] hover:border-[#1A1A1E]"
              }`}
            >
              <span className="text-2xl leading-none">→</span>
            </button>
          </div>
        </>
      )}

      <footer className="border-t border-[#E5E5E3] px-4 py-8 sm:px-8">
        <div
          className={`mx-auto flex w-full max-w-5xl flex-wrap items-center gap-6 ${
            showIngredients ? "justify-center" : "justify-between"
          }`}
        >
          {showIngredients ? (
            <div
              ref={startHitRef}
              className={`flex min-h-[6rem] min-w-[min(100%,20rem)] items-center justify-center border-2 border-dashed p-6 transition-colors duration-200 ${
                dwellFlash === "start"
                  ? "border-[#E8850A]/50 bg-[#E8850A]/5"
                  : "border-[#E5E5E3]"
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  setCookPhase("steps");
                  setIndex(0);
                }}
                className="min-h-[3.75rem] min-w-[16rem] rounded-full bg-[#E8850A] px-10 py-4 text-lg font-semibold text-white transition-colors duration-150 hover:bg-[#d4780a]"
              >
                Start cooking
              </button>
            </div>
          ) : null}
        </div>
      </footer>
    </div>
  );
}
