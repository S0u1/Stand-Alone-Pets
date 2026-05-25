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

export function sanitizeSettings(input: Partial<AppSettings> = {}): AppSettings {
  const petSize = Number(input.petSize);

  return {
    apiKey: typeof input.apiKey === "string" ? input.apiKey : defaultSettings.apiKey,
    baseURL:
      typeof input.baseURL === "string" && input.baseURL.trim().length > 0
        ? input.baseURL.trim().replace(/\/+$/, "")
        : defaultSettings.baseURL,
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

  constructor(userDataPath: string) {
    this.filePath = path.join(userDataPath, "settings.json");
  }

  get(): AppSettings {
    try {
      const raw = fs.readFileSync(this.filePath, "utf8");
      return sanitizeSettings(JSON.parse(raw) as Partial<AppSettings>);
    } catch {
      return defaultSettings;
    }
  }

  set(settings: Partial<AppSettings>): AppSettings {
    const next = sanitizeSettings({ ...this.get(), ...settings });
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(next, null, 2));
    return next;
  }
}
