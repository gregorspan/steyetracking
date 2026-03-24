"use client";

import { useLayoutEffect, useRef } from "react";

export type GazeDwellRegion = {
  id: string;
  ref: React.RefObject<HTMLElement | null>;
  /** When false, dwell never fires for this control */
  active: boolean;
};

type Options = {
  gazeRef: React.RefObject<{ x: number; y: number } | null>;
  enabled: boolean;
  regions: GazeDwellRegion[];
  dwellMs: number;
  cooldownMs: number;
  onActivate: (id: string) => void;
  resetKey?: string | number;
  hitPaddingPx?: number;
  /** EMA on raw gaze inside the rAF loop (same idea as former useSmoothedGaze) */
  smoothAlpha?: number;
};

/**
 * Dwell + optional smoothing run entirely in a requestAnimationFrame loop reading
 * gazeRef — no per-frame React state from gaze (avoids maximum update depth).
 */
export function useGazeDwell({
  gazeRef,
  enabled,
  regions,
  dwellMs,
  cooldownMs,
  onActivate,
  resetKey,
  hitPaddingPx = 0,
  smoothAlpha = 0.15,
}: Options) {
  const dwellStartRef = useRef<number | null>(null);
  const activeIdRef = useRef<string | null>(null);
  const cooldownUntilRef = useRef(0);
  const smoothedRef = useRef<{ x: number; y: number } | null>(null);
  const smoothPrimedRef = useRef(false);

  const onActivateRef = useRef(onActivate);
  onActivateRef.current = onActivate;
  const regionsRef = useRef(regions);
  regionsRef.current = regions;

  useLayoutEffect(() => {
    if (!enabled) {
      dwellStartRef.current = null;
      activeIdRef.current = null;
      smoothedRef.current = null;
      smoothPrimedRef.current = false;
      return;
    }

    let rafId = 0;

    const tick = () => {
      const raw = gazeRef.current;

      if (raw == null) {
        smoothedRef.current = null;
        smoothPrimedRef.current = false;
        dwellStartRef.current = null;
        activeIdRef.current = null;
      } else {
        if (!smoothPrimedRef.current) {
          smoothPrimedRef.current = true;
          smoothedRef.current = { x: raw.x, y: raw.y };
        } else {
          const s = smoothedRef.current!;
          const a = smoothAlpha;
          smoothedRef.current = {
            x: a * raw.x + (1 - a) * s.x,
            y: a * raw.y + (1 - a) * s.y,
          };
        }
      }

      const gaze = smoothedRef.current;
      const now = performance.now();

      if (gaze != null && now >= cooldownUntilRef.current) {
        const list = regionsRef.current;
        let hitId: string | null = null;
        for (const r of list) {
          if (!r.active) continue;
          const el = r.ref.current;
          if (!el) continue;
          const rect = el.getBoundingClientRect();
          const pad = hitPaddingPx;
          const left = rect.left - pad;
          const right = rect.right + pad;
          const top = rect.top - pad;
          const bottom = rect.bottom + pad;
          if (
            gaze.x >= left &&
            gaze.x <= right &&
            gaze.y >= top &&
            gaze.y <= bottom
          ) {
            hitId = r.id;
            break;
          }
        }

        if (hitId !== activeIdRef.current) {
          activeIdRef.current = hitId;
          dwellStartRef.current = hitId != null ? now : null;
        } else if (hitId != null && dwellStartRef.current != null) {
          if (now - dwellStartRef.current >= dwellMs) {
            cooldownUntilRef.current = now + cooldownMs;
            dwellStartRef.current = null;
            activeIdRef.current = null;
            onActivateRef.current(hitId);
          }
        }
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafId);
      dwellStartRef.current = null;
      activeIdRef.current = null;
    };
  }, [
    enabled,
    dwellMs,
    cooldownMs,
    hitPaddingPx,
    smoothAlpha,
    resetKey,
    gazeRef,
  ]);
}
