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
  const [displayGaze, setDisplayGaze] = useState<{ x: number; y: number } | null>(null);
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
    <div className="relative flex min-h-screen flex-col bg-[var(--bg)] text-[var(--fg)]">
      <header className="border-b border-[var(--border)] px-6 py-10 text-center">
        <p className="text-xs font-medium text-[var(--muted)]">
          University project · hands-free cooking
        </p>
        <h1
          className="mt-2 text-3xl font-semibold sm:text-4xl"
          style={{ letterSpacing: "-0.02em" }}
        >
          Hands-free recipe reader
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-[15px] leading-relaxed text-[var(--muted)]">
          This prototype explores eye tracking so you can follow recipes with messy
          hands — no scrolling or tapping on the screen. Here you calibrate the webcam
          tracker and try a live gaze preview. Open a recipe in{" "}
          <strong className="text-[var(--fg)]">Cooking mode</strong> to advance steps
          with your eyes and voice.
        </p>
        <p className="mt-6">
          <Link
            href="/"
            className="text-sm font-medium text-[var(--accent)] transition-colors duration-150 hover:text-[var(--accent-hover)]"
          >
            Open recipe search →
          </Link>
        </p>
      </header>

      <main className="flex flex-1 flex-col items-center px-4 pb-16 pt-10">
        {phase === "idle" && (
          <div className="flex max-w-md flex-col items-center gap-6 text-center">
            <p className="text-[15px] text-[var(--muted)]">
              Grant camera access so the page can estimate where you are looking.
              Use Chrome or Edge on HTTPS or localhost for the most reliable results.
            </p>
            <button
              type="button"
              onClick={() => void start()}
              className="rounded-full bg-[var(--accent)] px-8 py-3 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[var(--accent-hover)]"
            >
              Start calibration
            </button>
          </div>
        )}

        {phase === "loading" && (
          <p className="text-sm text-[var(--muted)]">Loading the tracker and camera…</p>
        )}

        {phase === "error" && error && (
          <div className="max-w-md border border-red-200 bg-red-50 px-6 py-4 text-center">
            <p className="text-sm text-red-600">{error}</p>
            <button
              type="button"
              onClick={() => { setPhase("idle"); void cleanupWebGazer(); }}
              className="mt-4 rounded border border-red-200 px-4 py-2 text-sm text-red-600 transition-colors duration-150 hover:bg-red-100"
            >
              Back to start
            </button>
          </div>
        )}

        {(phase === "calibrating" || phase === "tracking") && (
          <div className="flex w-full max-w-4xl flex-col gap-4">
            <div className="flex flex-wrap items-center justify-center gap-3">
              {phase === "calibrating" && (
                <span className="rounded border border-[var(--border)] px-4 py-1.5 text-xs font-medium text-[var(--muted)]">
                  Step {calibrationIndex + 1} of {CALIBRATION_POINTS.length}: look at the dot, then click.
                </span>
              )}
              {phase === "tracking" && (
                <>
                  <span className="rounded border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-4 py-1.5 text-xs font-medium text-[var(--accent)]">
                    Live gaze preview — red dot shows estimated gaze
                  </span>
                  <button
                    type="button"
                    onClick={() => void recalibrate()}
                    className="rounded border border-[var(--border)] px-4 py-1.5 text-xs text-[var(--muted)] transition-colors duration-150 hover:bg-[var(--hover-bg)] hover:text-[var(--fg)]"
                  >
                    Recalibrate
                  </button>
                  <button
                    type="button"
                    onClick={() => void stop()}
                    className="rounded border border-[var(--border)] px-4 py-1.5 text-xs text-[var(--muted)] transition-colors duration-150 hover:bg-[var(--hover-bg)] hover:text-[var(--fg)]"
                  >
                    End session
                  </button>
                </>
              )}
            </div>

            {phase === "tracking" && demoHint && (
              <p className="text-center text-sm text-[var(--muted)]">
                Look around the screen: the red dot shows how the system follows your eyes.
              </p>
            )}

            {phase === "tracking" && displayGaze && (
              <p className="text-center font-mono text-xs text-[var(--muted)]">
                Gaze: x {Math.round(displayGaze.x)} px · y {Math.round(displayGaze.y)} px
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
