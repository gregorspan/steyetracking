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
    <div className="relative flex min-h-screen flex-col bg-[#FAFAF9] text-[#1A1A1E]">
      <header className="border-b border-[#E5E5E3] px-6 py-10 text-center">
        <p className="text-xs font-medium text-[#8E8E93]">
          University project · hands-free cooking
        </p>
        <h1
          className="mt-2 text-3xl font-semibold text-[#1A1A1E] sm:text-4xl"
          style={{ letterSpacing: "-0.02em" }}
        >
          Hands-free recipe reader
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-[15px] leading-relaxed text-[#8E8E93]">
          This prototype explores eye tracking so you can follow recipes with messy
          hands — no scrolling or tapping on the screen. Here you calibrate the webcam
          tracker and try a live gaze preview. Open a recipe in{" "}
          <strong className="text-[#1A1A1E]">Cooking mode</strong> to advance steps
          with your eyes and voice.
        </p>
        <p className="mt-6">
          <Link
            href="/"
            className="text-sm font-medium text-[#E8850A] transition hover:text-[#d4780a]"
          >
            Open recipe search →
          </Link>
        </p>
      </header>

      <main className="flex flex-1 flex-col items-center px-4 pb-16 pt-10">
        {phase === "idle" && (
          <div className="flex max-w-md flex-col items-center gap-6 text-center">
            <p className="text-[15px] text-[#8E8E93]">
              Grant camera access so the page can estimate where you are looking.
              Use Chrome or Edge on HTTPS or localhost for the most reliable results.
            </p>
            <button
              type="button"
              onClick={() => void start()}
              className="rounded-full bg-[#E8850A] px-8 py-3 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#d4780a]"
            >
              Start calibration
            </button>
          </div>
        )}

        {phase === "loading" && (
          <p className="text-sm text-[#8E8E93]">Loading the tracker and camera…</p>
        )}

        {phase === "error" && error && (
          <div className="max-w-md border border-red-200 bg-red-50 px-6 py-4 text-center">
            <p className="text-sm text-red-600">{error}</p>
            <button
              type="button"
              onClick={() => {
                setPhase("idle");
                void cleanupWebGazer();
              }}
              className="mt-4 rounded px-4 py-2 text-sm text-red-600 border border-red-200 transition-colors duration-150 hover:bg-red-100"
            >
              Back to start
            </button>
          </div>
        )}

        {(phase === "calibrating" || phase === "tracking") && (
          <div className="flex w-full max-w-4xl flex-col gap-4">
            <div className="flex flex-wrap items-center justify-center gap-3">
              {phase === "calibrating" && (
                <span className="rounded px-4 py-1.5 text-xs font-medium text-[#8E8E93] border border-[#E5E5E3]">
                  Step {calibrationIndex + 1} of {CALIBRATION_POINTS.length}: look at
                  the dot, then click.
                </span>
              )}
              {phase === "tracking" && (
                <>
                  <span className="rounded px-4 py-1.5 text-xs font-medium text-[#E8850A] border border-[#E8850A]/30 bg-[#E8850A]/5">
                    Live gaze preview — red dot shows estimated gaze
                  </span>
                  <button
                    type="button"
                    onClick={() => void recalibrate()}
                    className="rounded px-4 py-1.5 text-xs text-[#8E8E93] border border-[#E5E5E3] transition-colors duration-150 hover:bg-[#F0F0EE] hover:text-[#1A1A1E]"
                  >
                    Recalibrate
                  </button>
                  <button
                    type="button"
                    onClick={() => void stop()}
                    className="rounded px-4 py-1.5 text-xs text-[#8E8E93] border border-[#E5E5E3] transition-colors duration-150 hover:bg-[#F0F0EE] hover:text-[#1A1A1E]"
                  >
                    End session
                  </button>
                </>
              )}
            </div>

            {phase === "tracking" && demoHint && (
              <p className="text-center text-sm text-[#8E8E93]">
                Look around the screen: the red dot shows how the system follows your
                eyes.
              </p>
            )}

            {phase === "tracking" && displayGaze && (
              <p className="text-center font-mono text-xs text-[#8E8E93]">
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
