import type { PetState } from "./types";

export interface AnimationFrame {
  rowIndex: number;
  columnIndex: number;
  frameDurationMs: number;
}

export const ATLAS_COLUMNS = 8;
export const ATLAS_ROWS = 9;

export const PET_ROWS: Record<PetState, number> = {
  idle: 0,
  "running-right": 1,
  "running-left": 2,
  waving: 3,
  jumping: 4,
  failed: 5,
  waiting: 6,
  running: 7,
  review: 8,
};

const idleFrames: AnimationFrame[] = [
  { rowIndex: PET_ROWS.idle, columnIndex: 0, frameDurationMs: 280 },
  { rowIndex: PET_ROWS.idle, columnIndex: 1, frameDurationMs: 110 },
  { rowIndex: PET_ROWS.idle, columnIndex: 2, frameDurationMs: 110 },
  { rowIndex: PET_ROWS.idle, columnIndex: 3, frameDurationMs: 140 },
  { rowIndex: PET_ROWS.idle, columnIndex: 4, frameDurationMs: 140 },
  { rowIndex: PET_ROWS.idle, columnIndex: 5, frameDurationMs: 320 },
];

const makeRowFrames = (
  state: PetState,
  frameCount: number,
  frameDurationMs: number,
  lastFrameDurationMs: number,
): AnimationFrame[] =>
  Array.from({ length: frameCount }, (_, columnIndex) => ({
    rowIndex: PET_ROWS[state],
    columnIndex,
    frameDurationMs:
      columnIndex === frameCount - 1 ? lastFrameDurationMs : frameDurationMs,
  }));

const stateFrames: Record<PetState, AnimationFrame[]> = {
  idle: idleFrames,
  "running-right": makeRowFrames("running-right", 8, 120, 220),
  "running-left": makeRowFrames("running-left", 8, 120, 220),
  waving: makeRowFrames("waving", 4, 140, 280),
  jumping: makeRowFrames("jumping", 5, 140, 280),
  failed: makeRowFrames("failed", 8, 140, 240),
  waiting: makeRowFrames("waiting", 6, 150, 260),
  running: makeRowFrames("running", 6, 120, 220),
  review: makeRowFrames("review", 6, 150, 280),
};

export function getAnimationSequence(
  state: PetState,
  reducedMotion = false,
): AnimationFrame[] {
  const frames = stateFrames[state] ?? stateFrames.idle;
  if (reducedMotion) {
    return [frames[0]];
  }
  if (state === "idle") {
    return frames;
  }
  return [...frames, ...frames, ...frames, ...idleFrames];
}

export function getBackgroundPosition(frame: AnimationFrame): string {
  const x = (frame.columnIndex / (ATLAS_COLUMNS - 1)) * 100;
  const y = (frame.rowIndex / (ATLAS_ROWS - 1)) * 100;
  return `${x}% ${y}%`;
}

