"use client";

import { CalibrationDots } from "@/components/eye-tracking/CalibrationDots";
import { CALIBRATION_POINTS } from "@/constants/eyeCalibration";
import { useGazeDwell } from "@/hooks/useGazeDwell";
import { useWebGazerSession } from "@/hooks/useWebGazerSession";
import type { RecipeDetail } from "@/types/recipe";
import Link from "next/link";
import { useCallback, useMemo, useRef, useState } from "react";

/** Longer dwell + padding helps noisy webcam gaze. */
const DWELL_MS = 1500;
const COOLDOWN_MS = 2000;
const GAZE_SMOOTH_ALPHA = 0.15;
const HIT_PADDING_PX = 36;

type CookPhase = "ingredients" | "steps";

type Props = { recipe: RecipeDetail };

export function RecipeCookClient({ recipe }: Props) {
  const steps = useMemo(
    () => (recipe.steps.length > 0 ? recipe.steps : ["No steps available."]),
    [recipe.steps],
  );
  const [cookPhase, setCookPhase] = useState<CookPhase>("ingredients");
  const [index, setIndex] = useState(0);
  const step = steps[index];
  const total = steps.length;

  const startHitRef = useRef<HTMLDivElement>(null);
  const prevZoneRef = useRef<HTMLDivElement>(null);
  const nextZoneRef = useRef<HTMLDivElement>(null);

  const eye = useWebGazerSession({
    showPredictionPointsWhileTracking: true,
  });

  const [dwellFlash, setDwellFlash] = useState<string | null>(null);

  const onGazeActivate = useCallback(
    (id: string) => {
      if (id === "start") {
        setCookPhase("steps");
        setIndex(0);
      }
      if (id === "next") {
        setIndex((i) => Math.min(total - 1, i + 1));
      }
      if (id === "prev") {
        setIndex((i) => Math.max(0, i - 1));
      }
      setDwellFlash(id);
      window.setTimeout(() => setDwellFlash(null), 600);
    },
    [total],
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
    enabled: eye.phase === "tracking",
    regions: gazeRegions,
    dwellMs: DWELL_MS,
    cooldownMs: COOLDOWN_MS,
    onActivate: onGazeActivate,
    resetKey: `${cookPhase}-${index}`,
    hitPaddingPx: HIT_PADDING_PX,
    smoothAlpha: GAZE_SMOOTH_ALPHA,
  });

  const showIngredients = cookPhase === "ingredients";

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
              </p>
            )}
          </>
        )}
      </main>

      {!showIngredients && eye.phase === "tracking" && (
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
