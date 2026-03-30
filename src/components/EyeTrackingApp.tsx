"use client";

import type { WebGazerInstance } from "@/types/webgazer";
import { useCallback, useEffect, useRef, useState } from "react";

type Phase = "idle" | "loading" | "calibrating" | "demo" | "cooking" | "error";

function loadWebGazerScript(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("No window"));
  }
  if (window.webgazer) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "/webgazer.js";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load /webgazer.js"));
    document.head.appendChild(s);
  });
}

/** Nine-point grid in normalized coordinates (0–1). */
const CALIBRATION_POINTS: { x: number; y: number }[] = [
  { x: 0.12, y: 0.12 },
  { x: 0.5, y: 0.12 },
  { x: 0.88, y: 0.12 },
  { x: 0.12, y: 0.5 },
  { x: 0.5, y: 0.5 },
  { x: 0.88, y: 0.5 },
  { x: 0.12, y: 0.88 },
  { x: 0.5, y: 0.88 },
  { x: 0.88, y: 0.88 },
];

const RECIPE_STEPS: { title: string; body: string }[] = [
  {
    title: "Prep",
    body: "Wash hands, gather ingredients, and preheat the oven to 200°C (or 400°F).",
  },
  {
    title: "Mix",
    body: "Combine dry ingredients in a bowl. Whisk until evenly mixed.",
  },
  {
    title: "Add wet",
    body: "Add wet ingredients and stir gently until just combined (don’t overmix).",
  },
  {
    title: "Bake",
    body: "Pour into a pan and bake for 18–22 minutes, until a toothpick comes out clean.",
  },
  {
    title: "Finish",
    body: "Let cool 10 minutes, then slice and serve.",
  },
];

const DWELL_MS = 900;
const EDGE_ZONE_FRACTION = 0.22;

export function EyeTrackingApp() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [calibrationIndex, setCalibrationIndex] = useState(0);
  const [gaze, setGaze] = useState<{ x: number; y: number } | null>(null);
  const [demoHint, setDemoHint] = useState(false);
  const [recipeStepIndex, setRecipeStepIndex] = useState(0);
  const [dwell, setDwell] = useState<{
    zone: "left" | "right" | null;
    progress: number;
  }>({ zone: null, progress: 0 });

  const wgRef = useRef<WebGazerInstance | null>(null);
  const phaseRef = useRef<Phase>(phase);
  const recipeStepIndexRef = useRef<number>(recipeStepIndex);
  const dwellRef = useRef<{
    zone: "left" | "right" | null;
    enteredAtMs: number | null;
    lastUiUpdateMs: number;
  }>({ zone: null, enteredAtMs: null, lastUiUpdateMs: 0 });

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    recipeStepIndexRef.current = recipeStepIndex;
  }, [recipeStepIndex]);

  const cleanupWebGazer = useCallback(async () => {
    const wg = wgRef.current;
    if (!wg) return;
    try {
      wg.clearGazeListener();
      wg.removeMouseEventListeners();
      wg.end();
    } catch {
      /* ignore */
    }
    wgRef.current = null;
    setGaze(null);
  }, []);

  useEffect(() => {
    return () => {
      void cleanupWebGazer();
    };
  }, [cleanupWebGazer]);

  const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

  const applyStepChange = useCallback((direction: "prev" | "next") => {
    setRecipeStepIndex((idx) => {
      if (direction === "prev") return Math.max(0, idx - 1);
      return Math.min(RECIPE_STEPS.length - 1, idx + 1);
    });
  }, []);

  const startPipeline = async () => {
    setError(null);
    setPhase("loading");
    try {
      await loadWebGazerScript();
      const webgazer = window.webgazer;
      wgRef.current = webgazer;

      webgazer.params.faceMeshSolutionPath = "/mediapipe/face_mesh";
      webgazer.saveDataAcrossSessions(false);
      await webgazer.clearData();

      await webgazer.begin(() => {
        setError(
          "Could not access the camera. Allow permission in your browser and try again.",
        );
        setPhase("error");
      });

      if (!webgazer.isReady()) {
        setError("The eye tracker did not finish starting up. Try refreshing the page.");
        setPhase("error");
        return;
      }

      webgazer.setVideoViewerSize(240, 180);
      webgazer.showVideoPreview(true);
      webgazer.showPredictionPoints(false);
      webgazer.removeMouseEventListeners();

      setCalibrationIndex(0);
      setPhase("calibrating");
    } catch (e) {
      console.error(e);
      setError(
        e instanceof Error ? e.message : "Could not start the eye tracker.",
      );
      setPhase("error");
      await cleanupWebGazer();
    }
  };

  const onCalibrationClick = (
    e: React.MouseEvent,
    pointIndex: number,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const wg = wgRef.current;
    if (!wg || phase !== "calibrating" || pointIndex !== calibrationIndex)
      return;

    wg.recordScreenPosition(e.clientX, e.clientY, "click");

    if (calibrationIndex >= CALIBRATION_POINTS.length - 1) {
      setPhase("demo");
      wg.setGazeListener((data) => {
        if (data == null) return;
        setGaze({ x: data.x, y: data.y });

        if (phaseRef.current !== "cooking") return;

        const w = window.innerWidth || 1;
        const xNorm = data.x / w;

        const inLeft = xNorm <= EDGE_ZONE_FRACTION;
        const inRight = xNorm >= 1 - EDGE_ZONE_FRACTION;
        const nextZone: "left" | "right" | null = inLeft
          ? "left"
          : inRight
            ? "right"
            : null;

        const now = performance.now();
        const s = dwellRef.current;

        if (nextZone !== s.zone) {
          dwellRef.current = {
            zone: nextZone,
            enteredAtMs: nextZone ? now : null,
            lastUiUpdateMs: s.lastUiUpdateMs,
          };
          setDwell({ zone: nextZone, progress: 0 });
          return;
        }

        if (!nextZone || s.enteredAtMs == null) {
          if (dwell.progress !== 0 || dwell.zone !== null) {
            setDwell({ zone: null, progress: 0 });
          }
          return;
        }

        const elapsed = now - s.enteredAtMs;
        const progress = clamp01(elapsed / DWELL_MS);

        if (now - s.lastUiUpdateMs > 60) {
          dwellRef.current.lastUiUpdateMs = now;
          setDwell({ zone: nextZone, progress });
        }

        if (elapsed >= DWELL_MS) {
          applyStepChange(nextZone === "right" ? "next" : "prev");
          dwellRef.current = {
            zone: null,
            enteredAtMs: null,
            lastUiUpdateMs: now,
          };
          setDwell({ zone: null, progress: 0 });
        }
      });
      wg.showPredictionPoints(true);
      setDemoHint(true);
      window.setTimeout(() => setDemoHint(false), 4000);
    } else {
      setCalibrationIndex((i) => i + 1);
    }
  };

  const finishDemo = async () => {
    await cleanupWebGazer();
    setPhase("idle");
    setCalibrationIndex(0);
    setRecipeStepIndex(0);
    setDwell({ zone: null, progress: 0 });
  };

  const recalibrate = async () => {
    const wg = wgRef.current;
    if (!wg) return;
    wg.clearGazeListener();
    wg.showPredictionPoints(false);
    await wg.clearData();
    wg.removeMouseEventListeners();
    setGaze(null);
    setCalibrationIndex(0);
    setRecipeStepIndex(0);
    setDwell({ zone: null, progress: 0 });
    dwellRef.current = { zone: null, enteredAtMs: null, lastUiUpdateMs: 0 };
    setPhase("calibrating");
  };

  return (
    <div className="relative flex min-h-screen flex-col bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <header className="border-b border-white/10 px-6 py-8 text-center">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-cyan-400/90">
          University project · hands-free cooking
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Hands-free recipe reader
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-slate-400">
          This prototype explores eye tracking so you can follow recipes with
          messy hands—no scrolling or tapping on the screen. Here you calibrate
          the webcam tracker and try a live gaze preview. A full recipe UI with
          gaze-driven controls would build on this foundation.
        </p>
      </header>

      <main className="flex flex-1 flex-col items-center px-4 pb-16 pt-8">
        {phase === "idle" && (
          <div className="flex max-w-md flex-col items-center gap-6 text-center">
            <p className="text-sm text-slate-400">
              Grant camera access so the page can estimate where you are looking.
              Use Chrome or Edge on HTTPS or localhost for the most reliable
              results in this coursework build.
            </p>
            <button
              type="button"
              onClick={() => void startPipeline()}
              className="rounded-full bg-cyan-500 px-8 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/25 transition hover:bg-cyan-400"
            >
              Start calibration
            </button>
          </div>
        )}

        {phase === "loading" && (
          <p className="text-sm text-slate-400">
            Loading the tracker and camera…
          </p>
        )}

        {phase === "error" && error && (
          <div className="max-w-md rounded-2xl border border-red-500/30 bg-red-950/40 px-6 py-4 text-center">
            <p className="text-sm text-red-200">{error}</p>
            <button
              type="button"
              onClick={() => {
                setPhase("idle");
                void cleanupWebGazer();
              }}
              className="mt-4 rounded-full border border-white/20 px-4 py-2 text-sm text-white hover:bg-white/10"
            >
              Back to start
            </button>
          </div>
        )}

        {(phase === "calibrating" || phase === "demo" || phase === "cooking") && (
          <div className="flex w-full max-w-4xl flex-col gap-4">
            <div className="flex flex-wrap items-center justify-center gap-3">
              {phase === "calibrating" && (
                <span className="rounded-full bg-white/10 px-4 py-1.5 text-xs font-medium text-slate-300">
                  Step {calibrationIndex + 1} of {CALIBRATION_POINTS.length}: look
                  at the dot, then click — trains the tracker for hands-free recipe
                  use
                </span>
              )}
              {phase === "demo" && (
                <>
                  <span className="rounded-full bg-emerald-500/20 px-4 py-1.5 text-xs font-medium text-emerald-300">
                    Prototype: red dot = estimated gaze (where a hands-free reader
                    could register “look here” actions)
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setRecipeStepIndex(0);
                      setDwell({ zone: null, progress: 0 });
                      dwellRef.current = {
                        zone: null,
                        enteredAtMs: null,
                        lastUiUpdateMs: performance.now(),
                      };
                      setPhase("cooking");
                    }}
                    className="rounded-full bg-cyan-500 px-4 py-1.5 text-xs font-semibold text-slate-950 shadow-lg shadow-cyan-500/25 transition hover:bg-cyan-400"
                  >
                    Enter cooking mode (gaze only)
                  </button>
                  <button
                    type="button"
                    onClick={() => void recalibrate()}
                    className="rounded-full border border-white/20 px-4 py-1.5 text-xs text-slate-200 hover:bg-white/10"
                  >
                    Recalibrate for a new session
                  </button>
                  <button
                    type="button"
                    onClick={() => void finishDemo()}
                    className="rounded-full border border-white/20 px-4 py-1.5 text-xs text-slate-200 hover:bg-white/10"
                  >
                    End prototype
                  </button>
                </>
              )}
              {phase === "cooking" && (
                <>
                  <span className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-slate-200">
                    Claude Cooking mode · look left / right · dwell{" "}
                    {Math.round(DWELL_MS / 100) / 10}s
                  </span>
                  <button
                    type="button"
                    onClick={() => setPhase("demo")}
                    className="rounded-full border border-white/20 px-4 py-1.5 text-xs text-slate-200 hover:bg-white/10"
                  >
                    Exit cooking mode
                  </button>
                  <button
                    type="button"
                    onClick={() => void recalibrate()}
                    className="rounded-full border border-white/20 px-4 py-1.5 text-xs text-slate-200 hover:bg-white/10"
                  >
                    Recalibrate
                  </button>
                </>
              )}
            </div>

            {phase === "demo" && demoHint && (
              <p className="text-center text-sm text-slate-400">
                Look around the screen: the red dot shows how the system could
                follow your eyes to advance steps or scroll a recipe hands-free.
              </p>
            )}

            {phase === "demo" && gaze && (
              <p className="text-center font-mono text-xs text-slate-500">
                Gaze position (for future UI): x {Math.round(gaze.x)} px · y{" "}
                {Math.round(gaze.y)} px
              </p>
            )}

            {phase === "cooking" && (
              <section className="mx-auto w-full max-w-3xl">
                <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/30 backdrop-blur">
                  <div className="flex flex-col gap-5">
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-500/15 ring-1 ring-cyan-400/20">
                            <svg
                              width="18"
                              height="18"
                              viewBox="0 0 24 24"
                              fill="none"
                              xmlns="http://www.w3.org/2000/svg"
                              className="text-cyan-200"
                            >
                              <path
                                d="M12 21c4.97 0 9-4.03 9-9s-4.03-9-9-9-9 4.03-9 9 4.03 9 9 9Z"
                                stroke="currentColor"
                                strokeWidth="1.6"
                              />
                              <path
                                d="M8.2 12.2c1.3-1.9 2.6-2.85 3.8-2.85s2.5.95 3.8 2.85"
                                stroke="currentColor"
                                strokeWidth="1.6"
                                strokeLinecap="round"
                              />
                              <path
                                d="M12 12.6v3.2"
                                stroke="currentColor"
                                strokeWidth="1.6"
                                strokeLinecap="round"
                              />
                            </svg>
                          </div>
                          <div>
                            <p className="text-xs font-medium uppercase tracking-[0.22em] text-slate-400">
                              Recipe · hands-free
                            </p>
                            <h2 className="mt-1 text-lg font-semibold text-white">
                              Quick demo recipe
                            </h2>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-400">Dwell</span>
                          <div className="h-2 w-36 overflow-hidden rounded-full bg-white/10">
                            <div
                              className={`h-full bg-cyan-400 transition-[width,opacity] ${
                                dwell.zone ? "opacity-100" : "opacity-60"
                              }`}
                              style={{
                                width: `${Math.round(dwell.progress * 100)}%`,
                              }}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="h-2 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full bg-gradient-to-r from-cyan-400/70 via-cyan-400 to-emerald-400/70 transition-[width]"
                          style={{
                            width: `${Math.round(
                              ((recipeStepIndex + 1) / RECIPE_STEPS.length) * 100,
                            )}%`,
                          }}
                        />
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-xs text-slate-400">
                          Step{" "}
                          <span className="font-semibold text-slate-200">
                            {recipeStepIndex + 1}
                          </span>{" "}
                          of{" "}
                          <span className="font-semibold text-slate-200">
                            {RECIPE_STEPS.length}
                          </span>
                        </p>
                        <div className="flex items-center gap-1.5">
                          {RECIPE_STEPS.map((_, i) => {
                            const active = i === recipeStepIndex;
                            const done = i < recipeStepIndex;
                            return (
                              <span
                                key={i}
                                className={`h-2 w-2 rounded-full transition ${
                                  active
                                    ? "bg-cyan-300 shadow-[0_0_0_4px_rgba(34,211,238,0.15)]"
                                    : done
                                      ? "bg-emerald-400/80"
                                      : "bg-white/15"
                                }`}
                                aria-hidden="true"
                              />
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-6">
                      <h3 className="text-3xl font-semibold tracking-tight text-white">
                        {RECIPE_STEPS[recipeStepIndex]?.title ?? "Recipe step"}
                      </h3>
                      <p className="mt-3 text-base leading-relaxed text-slate-200">
                        {RECIPE_STEPS[recipeStepIndex]?.body ??
                          "Add recipe content here."}
                      </p>
                    </div>

                    <div className="flex items-center justify-between gap-4 text-xs text-slate-400">
                      <span>
                        Left edge:{" "}
                        <span className="font-semibold text-slate-200">Back</span>
                        {recipeStepIndex === 0 ? " (start)" : ""}
                      </span>
                      <span>
                        Right edge:{" "}
                        <span className="font-semibold text-slate-200">Next</span>
                        {recipeStepIndex === RECIPE_STEPS.length - 1
                          ? " (end)"
                          : ""}
                      </span>
                    </div>
                  </div>
                </div>
              </section>
            )}
          </div>
        )}
      </main>

      {phase === "cooking" && (
        <>
          <div
            className={`pointer-events-none fixed inset-y-0 left-0 z-[99999] w-[22vw] border-r border-white/5 bg-gradient-to-r from-white/5 to-transparent transition ${
              dwell.zone === "left" ? "from-cyan-500/15" : ""
            }`}
            aria-hidden="true"
          />
          <div
            className={`pointer-events-none fixed inset-y-0 right-0 z-[99999] w-[22vw] border-l border-white/5 bg-gradient-to-l from-white/5 to-transparent transition ${
              dwell.zone === "right" ? "from-cyan-500/15" : ""
            }`}
            aria-hidden="true"
          />
          <div
            className="pointer-events-none fixed left-5 top-1/2 z-[100000] -translate-y-1/2"
            aria-hidden="true"
          >
            <div
              className={`flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs backdrop-blur transition ${
                dwell.zone === "left"
                  ? "border-cyan-400/30 bg-cyan-500/10 text-cyan-100"
                  : "border-white/10 bg-slate-950/40 text-slate-300"
              }`}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M14.5 5.5 8 12l6.5 6.5"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="font-medium">Back</span>
            </div>
          </div>
          <div
            className="pointer-events-none fixed right-5 top-1/2 z-[100000] -translate-y-1/2"
            aria-hidden="true"
          >
            <div
              className={`flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs backdrop-blur transition ${
                dwell.zone === "right"
                  ? "border-cyan-400/30 bg-cyan-500/10 text-cyan-100"
                  : "border-white/10 bg-slate-950/40 text-slate-300"
              }`}
            >
              <span className="font-medium">Next</span>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M9.5 5.5 16 12l-6.5 6.5"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>
          <div
            className="pointer-events-none fixed bottom-6 left-1/2 z-[100000] w-full max-w-xl -translate-x-1/2 px-4"
            aria-hidden="true"
          >
            <div className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-center text-xs text-slate-300 backdrop-blur">
              {dwell.zone ? (
                <span>
                  Hold to{" "}
                  <span className="font-semibold text-white">
                    {dwell.zone === "left" ? "go back" : "go next"}
                  </span>{" "}
                  ({Math.round(dwell.progress * 100)}%)
                </span>
              ) : (
                <span>
                  Look to the left or right edge to navigate. No clicks needed.
                </span>
              )}
            </div>
          </div>
        </>
      )}

      {/* Calibration targets */}
      {phase === "calibrating" &&
        CALIBRATION_POINTS.map((p, i) => {
          const active = i === calibrationIndex;
          return (
            <button
              key={i}
              type="button"
              aria-label={`Recipe reader calibration point ${i + 1} of ${CALIBRATION_POINTS.length}`}
              className={`fixed z-[100001] flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border-4 shadow-lg transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                active
                  ? "border-cyan-400 bg-cyan-500/30 shadow-cyan-500/40"
                  : "border-white/15 bg-white/5 opacity-40"
              }`}
              style={{
                left: `${p.x * 100}%`,
                top: `${p.y * 100}%`,
                pointerEvents: active ? "auto" : "none",
              }}
              onClick={(e) => onCalibrationClick(e, i)}
            >
              <span className="h-3 w-3 rounded-full bg-white" />
            </button>
          );
        })}

    </div>
  );
}
