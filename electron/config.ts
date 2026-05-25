import fs from "node:fs";
import path from "node:path";
import type { PetDescriptor } from "./pets";

export interface AppSettings {
  apiKey: string;
  baseURL: string;
  model: string;
  systemPrompt: string;
  selectedPetId: string;
  clickThrough: boolean;
  alwaysOnTop: boolean;
  petSize: number;
}

export interface SecretCodec {
  canEncrypt(): boolean;
  encrypt(value: string): string;
  decrypt(value: string): string;
}

type StoredSettings = Partial<AppSettings> & {
  apiKeyEncrypted?: string;
};

export const defaultSettings: AppSettings = {
  apiKey: "",
  baseURL: "https://api.openai.com/v1",
  model: "gpt-4.1-mini",
  systemPrompt:
    "You are a warm, concise desktop companion. Keep replies helpful, playful, and brief.",
  selectedPetId: "builtin-spark",
  clickThrough: false,
  alwaysOnTop: true,
  petSize: 112,
};

function sanitizeBaseURL(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    return defaultSettings.baseURL;
  }

  try {
    const parsed = new URL(value.trim());
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return defaultSettings.baseURL;
    }

    return parsed.toString().replace(/\/+$/, "");
  } catch {
    return defaultSettings.baseURL;
  }
}

export function sanitizeSettings(input: Partial<AppSettings> = {}): AppSettings {
  const petSize = Number(input.petSize);

  return {
    apiKey: typeof input.apiKey === "string" ? input.apiKey : defaultSettings.apiKey,
    baseURL: sanitizeBaseURL(input.baseURL),
    model:
      typeof input.model === "string" && input.model.trim().length > 0
        ? input.model.trim()
        : defaultSettings.model,
    systemPrompt:
      typeof input.systemPrompt === "string" && input.systemPrompt.trim().length > 0
        ? input.systemPrompt
        : defaultSettings.systemPrompt,
    selectedPetId:
      typeof input.selectedPetId === "string" && input.selectedPetId.trim().length > 0
        ? input.selectedPetId
        : defaultSettings.selectedPetId,
    clickThrough:
      typeof input.clickThrough === "boolean"
        ? input.clickThrough
        : defaultSettings.clickThrough,
    alwaysOnTop:
      typeof input.alwaysOnTop === "boolean"
        ? input.alwaysOnTop
        : defaultSettings.alwaysOnTop,
    petSize: Number.isFinite(petSize)
      ? Math.round(Math.min(224, Math.max(80, petSize)))
      : defaultSettings.petSize,
  };
}

export function buildPetSystemPrompt(
  basePrompt: string,
  pet: Pick<PetDescriptor, "displayName" | "description">,
): string {
  const trimmedBasePrompt = basePrompt.trim() || defaultSettings.systemPrompt;
  return [
    trimmedBasePrompt,
    "",
    "Current desktop pet identity:",
    `- Name: ${pet.displayName}`,
    `- Description: ${pet.description}`,
    "",
    `Reply as ${pet.displayName}. Keep the pet's name and personality in mind.`,
  ].join("\n");
}

export class JsonConfigStore {
  private readonly filePath: string;
  private readonly secretCodec: SecretCodec | null;

  constructor(userDataPath: string, secretCodec: SecretCodec | null = null) {
    this.filePath = path.join(userDataPath, "settings.json");
    this.secretCodec = secretCodec;
  }

  get(): AppSettings {
    try {
      const raw = fs.readFileSync(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as StoredSettings;
      return sanitizeSettings({
        ...parsed,
        apiKey: this.readApiKey(parsed),
      });
    } catch {
      return defaultSettings;
    }
  }

  set(settings: Partial<AppSettings>): AppSettings {
    const next = sanitizeSettings({ ...this.get(), ...settings });
    const stored = this.prepareStoredSettings(next);
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(stored, null, 2));
    return next;
  }

  private readApiKey(settings: StoredSettings): string {
    if (
      settings.apiKeyEncrypted &&
      this.secretCodec?.canEncrypt()
    ) {
      try {
        return this.secretCodec.decrypt(settings.apiKeyEncrypted);
      } catch {
        return "";
      }
    }

    return typeof settings.apiKey === "string" ? settings.apiKey : "";
  }

  private prepareStoredSettings(settings: AppSettings): StoredSettings {
    if (settings.apiKey.length === 0 || !this.secretCodec?.canEncrypt()) {
      return settings;
    }

    return {
      ...settings,
      apiKey: "",
      apiKeyEncrypted: this.secretCodec.encrypt(settings.apiKey),
    };
  }
}
