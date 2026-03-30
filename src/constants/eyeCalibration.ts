/**
 * Nine-point grid in normalized coordinates (0–1).
 * Wider spread (near edges) usually tracks better than a tight cluster.
 * Only bottom-left is nudged inward — WebGazer preview sits in that corner.
 * Right column slightly inset from 1.0 for scrollbars / OS UI.
 */
export const CALIBRATION_POINTS: { x: number; y: number }[] = [
  { x: 0.1, y: 0.1 },
  { x: 0.5, y: 0.1 },
  { x: 0.9, y: 0.1 },
  { x: 0.1, y: 0.5 },
  { x: 0.5, y: 0.5 },
  { x: 0.9, y: 0.5 },
  { x: 0.3, y: 0.8 },
  { x: 0.5, y: 0.88 },
  { x: 0.9, y: 0.88 },
];
