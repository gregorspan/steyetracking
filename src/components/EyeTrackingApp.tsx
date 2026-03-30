"use client";

import { CalibrationDots } from "@/components/eye-tracking/CalibrationDots";
import { CALIBRATION_POINTS } from "@/constants/eyeCalibration";
import { useWebGazerSession } from "@/hooks/useWebGazerSession";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export function EyeTrackingApp() {
  const {
    phase,
    error,
    gazeRef,
    calibrationIndex,
    start,
    stop,
    recalibrate,
    onCalibrationClick,
    cleanupWebGazer,
    setPhase,
  } = useWebGazerSession({ showPredictionPointsWhileTracking: true });

  const [demoHint, setDemoHint] = useState(false);
  const [displayGaze, setDisplayGaze] = useState<{ x: number; y: number } | null>(
    null,
  );
  const prevPhaseRef = useRef(phase);

  useEffect(() => {
    if (prevPhaseRef.current === "calibrating" && phase === "tracking") {
      setDemoHint(true);
      const t = window.setTimeout(() => setDemoHint(false), 4000);
      prevPhaseRef.current = phase;
      return () => clearTimeout(t);
    }
    prevPhaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    if (phase !== "tracking") {
      setDisplayGaze(null);
      return;
    }
    const id = window.setInterval(() => {
      const g = gazeRef.current;
      setDisplayGaze(g ? { x: g.x, y: g.y } : null);
    }, 200);
    return () => clearInterval(id);
  }, [phase, gazeRef]);

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
          This prototype explores eye tracking so you can follow recipes with messy
          hands-no scrolling or tapping on the screen. Here you calibrate the webcam
          tracker and try a live gaze preview. Open a recipe in{" "}
          <strong className="text-slate-300">Cooking mode</strong> to advance steps
          with your eyes and voice.
        </p>
        <p className="mt-6">
          <Link
            href="/"
            className="text-sm font-medium text-cyan-400 underline-offset-4 hover:text-cyan-300 hover:underline"
          >
            Open recipe search
          </Link>
        </p>
      </header>

      <main className="flex flex-1 flex-col items-center px-4 pb-16 pt-8">
        {phase === "idle" && (
          <div className="flex max-w-md flex-col items-center gap-6 text-center">
            <p className="text-sm text-slate-400">
              Grant camera access so the page can estimate where you are looking.
              Use Chrome or Edge on HTTPS or localhost for the most reliable results.
            </p>
            <button
              type="button"
              onClick={() => void start()}
              className="rounded-full bg-cyan-500 px-8 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/25 transition hover:bg-cyan-400"
            >
              Start calibration
            </button>
          </div>
        )}

        {phase === "loading" && (
          <p className="text-sm text-slate-400">Loading the tracker and camera…</p>
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

        {(phase === "calibrating" || phase === "tracking") && (
          <div className="flex w-full max-w-4xl flex-col gap-4">
            <div className="flex flex-wrap items-center justify-center gap-3">
              {phase === "calibrating" && (
                <span className="rounded-full bg-white/10 px-4 py-1.5 text-xs font-medium text-slate-300">
                  Step {calibrationIndex + 1} of {CALIBRATION_POINTS.length}: look at
                  the dot, then click.
                </span>
              )}
              {phase === "tracking" && (
                <>
                  <span className="rounded-full bg-emerald-500/20 px-4 py-1.5 text-xs font-medium text-emerald-300">
                    Live gaze preview — red dot shows estimated gaze
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
                    onClick={() => void stop()}
                    className="rounded-full border border-white/20 px-4 py-1.5 text-xs text-slate-200 hover:bg-white/10"
                  >
                    End session
                  </button>
                </>
              )}
            </div>

            {phase === "tracking" && demoHint && (
              <p className="text-center text-sm text-slate-400">
                Look around the screen: the red dot shows how the system follows your
                eyes.
              </p>
            )}

            {phase === "tracking" && displayGaze && (
              <p className="text-center font-mono text-xs text-slate-500">
                Gaze: x {Math.round(displayGaze.x)} px · y{" "}
                {Math.round(displayGaze.y)} px
              </p>
            )}
          </div>
        )}
      </main>

      {phase === "calibrating" && (
        <CalibrationDots
          calibrationIndex={calibrationIndex}
          onPointClick={onCalibrationClick}
        />
      )}
    </div>
  );
}
