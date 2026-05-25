import { describe, expect, it } from "vitest";
import { getIncrementalDelta } from "../electron/llm";

describe("LLM stream delta normalization", () => {
  it("keeps standard incremental deltas unchanged", () => {
    expect(getIncrementalDelta("你好", "，Stand_Alone_Pets")).toBe("，Stand_Alone_Pets");
  });

  it("extracts only the suffix from cumulative chunks", () => {
    expect(getIncrementalDelta("你好", "你好，Stand_Alone_Pets")).toBe("，Stand_Alone_Pets");
  });

  it("ignores repeated full chunks", () => {
    expect(getIncrementalDelta("你好，Stand_Alone_Pets", "你好，Stand_Alone_Pets")).toBe("");
  });

  it("uses overlap detection for partially repeated chunks", () => {
    expect(getIncrementalDelta("abcdef", "defghi")).toBe("ghi");
  });
});
