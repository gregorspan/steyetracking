"use client";

import type { WebGazerInstance } from "@/types/webgazer";
import { useCallback, useEffect, useRef, useState } from "react";

type Phase = "idle" | "loading" | "calibrating" | "demo" | "error";

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

export function EyeTrackingApp() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [calibrationIndex, setCalibrationIndex] = useState(0);
  const [gaze, setGaze] = useState<{ x: number; y: number } | null>(null);
  const [demoHint, setDemoHint] = useState(false);

  const wgRef = useRef<WebGazerInstance | null>(null);

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
        setError("Could not access the camera. Allow permission and try again.");
        setPhase("error");
      });

      if (!webgazer.isReady()) {
        setError("Eye tracker did not initialize. Try refreshing.");
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
        e instanceof Error ? e.message : "Failed to start eye tracking.",
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
    setPhase("calibrating");
  };

  return (
    <div className="relative flex min-h-screen flex-col bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <header className="border-b border-white/10 px-6 py-8 text-center">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-cyan-400/90">
          WebGazer · webcam gaze estimation
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Eye tracking demo
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-slate-400">
          Calibration learns a mapping from your face to screen coordinates.
          Look at each dot and click it. Then the demo shows where the model
          thinks you are looking — accuracy varies by lighting and hardware.
        </p>
      </header>

      <main className="flex flex-1 flex-col items-center px-4 pb-16 pt-8">
        {phase === "idle" && (
          <div className="flex max-w-md flex-col items-center gap-6 text-center">
            <p className="text-sm text-slate-400">
              Uses your laptop camera in the browser. Works best on Chrome or
              Edge over HTTPS or localhost.
            </p>
            <button
              type="button"
              onClick={() => void startPipeline()}
              className="rounded-full bg-cyan-500 px-8 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/25 transition hover:bg-cyan-400"
            >
              Start camera &amp; calibration
            </button>
          </div>
        )}

        {phase === "loading" && (
          <p className="text-sm text-slate-400">
            Loading models and camera…
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
              Back
            </button>
          </div>
        )}

        {(phase === "calibrating" || phase === "demo") && (
          <div className="flex w-full max-w-4xl flex-col gap-4">
            <div className="flex flex-wrap items-center justify-center gap-3">
              {phase === "calibrating" && (
                <span className="rounded-full bg-white/10 px-4 py-1.5 text-xs font-medium text-slate-300">
                  Point {calibrationIndex + 1} of {CALIBRATION_POINTS.length}{" "}
                  — look at the dot, then click it
                </span>
              )}
              {phase === "demo" && (
                <>
                  <span className="rounded-full bg-emerald-500/20 px-4 py-1.5 text-xs font-medium text-emerald-300">
                    Demo: red dot = predicted gaze (WebGazer overlay)
                  </span>
                  <button
                    type="button"
                    onClick={() => void recalibrate()}
                    className="rounded-full border border-white/20 px-4 py-1.5 text-xs text-slate-200 hover:bg-white/10"
                  >
                    Recalibrate
                  </button>
                  <button
                    type="button"
                    onClick={() => void finishDemo()}
                    className="rounded-full border border-white/20 px-4 py-1.5 text-xs text-slate-200 hover:bg-white/10"
                  >
                    Stop
                  </button>
                </>
              )}
            </div>

            {phase === "demo" && demoHint && (
              <p className="text-center text-sm text-slate-400">
                Move your eyes; the small red circle follows your gaze estimate.
              </p>
            )}

            {phase === "demo" && gaze && (
              <p className="text-center font-mono text-xs text-slate-500">
                x: {Math.round(gaze.x)} px · y: {Math.round(gaze.y)} px
              </p>
            )}
          </div>
        )}
      </main>

      {/* Calibration targets */}
      {phase === "calibrating" &&
        CALIBRATION_POINTS.map((p, i) => {
          const active = i === calibrationIndex;
          return (
            <button
              key={i}
              type="button"
              aria-label={`Calibration point ${i + 1}`}
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
