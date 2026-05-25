import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  JsonConfigStore,
  buildPetSystemPrompt,
  defaultSettings,
  sanitizeSettings,
  type SecretCodec,
} from "../electron/config";

const tempDirs: string[] = [];

function createTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "stand-alone-pets-config-"));
  tempDirs.push(dir);
  return dir;
}

const testSecretCodec: SecretCodec = {
  canEncrypt: () => true,
  encrypt: (value) => Buffer.from(value, "utf8").toString("base64"),
  decrypt: (value) => Buffer.from(value, "base64").toString("utf8"),
};

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

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

  it("rejects unsupported API base URL protocols", () => {
    expect(sanitizeSettings({ baseURL: "file:///tmp/socket" }).baseURL).toBe(
      defaultSettings.baseURL,
    );
    expect(sanitizeSettings({ baseURL: "javascript:alert(1)" }).baseURL).toBe(
      defaultSettings.baseURL,
    );
    expect(sanitizeSettings({ baseURL: "http://localhost:11434/v1" }).baseURL).toBe(
      "http://localhost:11434/v1",
    );
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

  it("encrypts API keys at rest when a secret codec is available", () => {
    const userDataPath = createTempDir();
    const store = new JsonConfigStore(userDataPath, testSecretCodec);

    const settings = store.set({ apiKey: "secret-key" });
    const raw = JSON.parse(
      fs.readFileSync(path.join(userDataPath, "settings.json"), "utf8"),
    ) as Record<string, unknown>;

    expect(settings.apiKey).toBe("secret-key");
    expect(raw.apiKey).toBe("");
    expect(raw.apiKeyEncrypted).toBe("c2VjcmV0LWtleQ==");
    expect(store.get().apiKey).toBe("secret-key");
  });

  it("can read legacy plaintext API keys", () => {
    const userDataPath = createTempDir();
    fs.writeFileSync(
      path.join(userDataPath, "settings.json"),
      JSON.stringify({ ...defaultSettings, apiKey: "legacy-key" }),
    );

    expect(new JsonConfigStore(userDataPath, testSecretCodec).get().apiKey).toBe(
      "legacy-key",
    );
  });
});
