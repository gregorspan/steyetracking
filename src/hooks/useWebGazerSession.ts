"use client";

import { CALIBRATION_POINTS } from "@/constants/eyeCalibration";
import { loadWebGazerScript } from "@/lib/webgazer/loadScript";
import type { WebGazerInstance } from "@/types/webgazer";
import { useCallback, useEffect, useRef, useState } from "react";

export type WebGazerSessionPhase =
  | "idle"
  | "loading"
  | "calibrating"
  | "tracking"
  | "error";

type Options = {
  /** WebGazer red gaze dot overlay */
  showPredictionPointsWhileTracking?: boolean;
};

export function useWebGazerSession(options: Options = {}) {
  const { showPredictionPointsWhileTracking = true } = options;

  const [phase, setPhase] = useState<WebGazerSessionPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [calibrationIndex, setCalibrationIndex] = useState(0);

  const wgRef = useRef<WebGazerInstance | null>(null);
  /**
   * Latest gaze from WebGazer — updated every callback, no React setState.
   * Dwell / smoothing read this in an rAF loop to avoid update-depth cascades.
   */
  const gazeRef = useRef<{ x: number; y: number } | null>(null);
  const calibrationCompleteRef = useRef(false);

  const cleanupWebGazer = useCallback(async () => {
    gazeRef.current = null;
    calibrationCompleteRef.current = false;

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
  }, []);

  useEffect(() => {
    return () => {
      void cleanupWebGazer();
    };
  }, [cleanupWebGazer]);

  const start = useCallback(async () => {
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
        setError(
          "The eye tracker did not finish starting up. Try refreshing the page.",
        );
        setPhase("error");
        return;
      }

      webgazer.setVideoViewerSize(240, 180);
      webgazer.showVideoPreview(true);
      webgazer.showPredictionPoints(false);
      webgazer.removeMouseEventListeners();

      setCalibrationIndex(0);
      calibrationCompleteRef.current = false;
      gazeRef.current = null;
      setPhase("calibrating");
    } catch (e) {
      console.error(e);
      setError(
        e instanceof Error ? e.message : "Could not start the eye tracker.",
      );
      setPhase("error");
      await cleanupWebGazer();
    }
  }, [cleanupWebGazer]);

  const onCalibrationClick = useCallback(
    (e: React.MouseEvent, pointIndex: number) => {
      e.preventDefault();
      e.stopPropagation();
      const wg = wgRef.current;
      if (!wg || phase !== "calibrating" || pointIndex !== calibrationIndex)
        return;

      wg.recordScreenPosition(e.clientX, e.clientY, "click");

      if (calibrationIndex >= CALIBRATION_POINTS.length - 1) {
        if (calibrationCompleteRef.current) return;
        calibrationCompleteRef.current = true;

        try {
          wg.clearGazeListener();
        } catch {
          /* ignore */
        }

        setPhase("tracking");
        wg.setGazeListener((data) => {
          if (data == null) {
            gazeRef.current = null;
            return;
          }
          gazeRef.current = { x: data.x, y: data.y };
        });
        wg.showPredictionPoints(showPredictionPointsWhileTracking);
      } else {
        setCalibrationIndex((i) => i + 1);
      }
    },
    [phase, calibrationIndex, showPredictionPointsWhileTracking],
  );

  const stop = useCallback(async () => {
    await cleanupWebGazer();
    setPhase("idle");
    setCalibrationIndex(0);
  }, [cleanupWebGazer]);

  const recalibrate = useCallback(async () => {
    const wg = wgRef.current;
    if (!wg) return;
    gazeRef.current = null;
    calibrationCompleteRef.current = false;
    wg.clearGazeListener();
    wg.showPredictionPoints(false);
    await wg.clearData();
    wg.removeMouseEventListeners();
    setCalibrationIndex(0);
    setPhase("calibrating");
  }, []);

  useEffect(() => {
    const wg = wgRef.current;
    if (!wg) return;
    // Keep prediction dot hidden outside tracking, and reactive during tracking.
    wg.showPredictionPoints(phase === "tracking" && showPredictionPointsWhileTracking);
  }, [phase, showPredictionPointsWhileTracking]);

  return {
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
    setError,
  };
}
