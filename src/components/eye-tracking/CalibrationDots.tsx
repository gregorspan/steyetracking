"use client";

import { CALIBRATION_POINTS } from "@/constants/eyeCalibration";

type Props = {
  calibrationIndex: number;
  onPointClick: (e: React.MouseEvent, pointIndex: number) => void;
};

export function CalibrationDots({ calibrationIndex, onPointClick }: Props) {
  return (
    <>
      {CALIBRATION_POINTS.map((p, i) => {
        const active = i === calibrationIndex;
        return (
          <button
            key={i}
            type="button"
            aria-label={`Calibration point ${i + 1} of ${CALIBRATION_POINTS.length}`}
            className={`fixed z-[100110] flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border-4 transition duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E8850A] ${
              active
                ? "border-[#E8850A] bg-[#E8850A]/20"
                : "border-[#E5E5E3] bg-white/60 opacity-40"
            }`}
            style={{
              left: `${p.x * 100}%`,
              top: `${p.y * 100}%`,
              pointerEvents: active ? "auto" : "none",
            }}
            onClick={(e) => onPointClick(e, i)}
          >
            <span className="h-3 w-3 rounded-full bg-[#E8850A]" />
          </button>
        );
      })}
    </>
  );
}
