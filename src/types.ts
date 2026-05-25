export type PetState =
  | "idle"
  | "running-right"
  | "running-left"
  | "waving"
  | "jumping"
  | "failed"
  | "waiting"
  | "running"
  | "review";

export interface PetManifest {
  id: string;
  displayName: string;
  description: string;
  spritesheetPath: string;
}

export interface PetDescriptor {
  id: string;
  displayName: string;
  description: string;
  spritesheetUrl: string | null;
  isBuiltIn: boolean;
}

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

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatRequest {
  requestId: string;
  messages: ChatMessage[];
}

export interface ChatChunk {
  requestId: string;
  delta: string;
}

export interface ChatDone {
  requestId: string;
  ok: boolean;
  error?: string;
}

