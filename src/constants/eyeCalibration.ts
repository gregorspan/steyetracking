/**
 * Nine-point grid in normalized coordinates (0–1).
 * Keep left column near the edge for better spread, but nudge only the
 * bottom-left point inward so it stays visible near the webcam preview.
 */
export const CALIBRATION_POINTS: { x: number; y: number }[] = [
  { x: 0.1, y: 0.14 },
  { x: 0.5, y: 0.14 },
  { x: 0.9, y: 0.14 },
  { x: 0.1, y: 0.46 },
  { x: 0.5, y: 0.46 },
  { x: 0.9, y: 0.46 },
  { x: 0.1, y: 0.78 },
  { x: 0.5, y: 0.78 },
  { x: 0.9, y: 0.78 },
];
