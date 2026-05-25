import { describe, expect, it } from "vitest";
import { buildPetSystemPrompt, defaultSettings, sanitizeSettings } from "../electron/config";

describe("settings sanitization", () => {
  it("uses defaults for missing values", () => {
    expect(sanitizeSettings()).toEqual(defaultSettings);
  });

  it("trims URL and model fields", () => {
    const settings = sanitizeSettings({
      baseURL: " https://api.example.com/v1/// ",
      model: " custom-model ",
    });

    expect(settings.baseURL).toBe("https://api.example.com/v1");
    expect(settings.model).toBe("custom-model");
  });

  it("clamps pet size", () => {
    expect(sanitizeSettings({ petSize: 10 }).petSize).toBe(80);
    expect(sanitizeSettings({ petSize: 999 }).petSize).toBe(224);
  });

  it("injects the selected pet identity into the system prompt", () => {
    const prompt = buildPetSystemPrompt("Be brief.", {
      displayName: "Ghosty",
      description: "A quiet spectral desk companion.",
    });

    expect(prompt).toContain("Be brief.");
    expect(prompt).toContain("Name: Ghosty");
    expect(prompt).toContain("Description: A quiet spectral desk companion.");
    expect(prompt).toContain("Reply as Ghosty");
  });
});
