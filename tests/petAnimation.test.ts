import { describe, expect, it } from "vitest";
import {
  ATLAS_COLUMNS,
  ATLAS_ROWS,
  PET_ROWS,
  getAnimationSequence,
  getBackgroundPosition,
} from "../src/petAnimation";
import type { PetState } from "../src/types";

const expectedFrames: Record<PetState, number> = {
  idle: 6,
  "running-right": 8,
  "running-left": 8,
  waving: 4,
  jumping: 5,
  failed: 8,
  waiting: 6,
  running: 6,
  review: 6,
};

describe("pet animation contract", () => {
  it("uses the Codex 8 by 9 atlas geometry", () => {
    expect(ATLAS_COLUMNS).toBe(8);
    expect(ATLAS_ROWS).toBe(9);
  });

  it("maps every state to the expected row and frame count", () => {
    for (const [state, rowIndex] of Object.entries(PET_ROWS)) {
      const frames = getAnimationSequence(state as PetState);
      const baseCount = expectedFrames[state as PetState];

      expect(frames[0].rowIndex).toBe(rowIndex);
      expect(frames.slice(0, baseCount).every((frame) => frame.rowIndex === rowIndex)).toBe(true);
    }
  });

  it("returns only the first frame for reduced motion", () => {
    expect(getAnimationSequence("running", true)).toEqual([
      { rowIndex: PET_ROWS.running, columnIndex: 0, frameDurationMs: 120 },
    ]);
  });

  it("converts frame coordinates to CSS background positions", () => {
    expect(getBackgroundPosition({ rowIndex: 0, columnIndex: 0, frameDurationMs: 100 })).toBe("0% 0%");
    expect(getBackgroundPosition({ rowIndex: 8, columnIndex: 7, frameDurationMs: 100 })).toBe("100% 100%");
  });
});

