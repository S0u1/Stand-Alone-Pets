import { describe, expect, it } from "vitest";
import viteConfig from "../vite.config";

describe("Vite packaging config", () => {
  it("uses relative asset URLs for file:// Electron builds", () => {
    expect(viteConfig.base).toBe("./");
  });
});
