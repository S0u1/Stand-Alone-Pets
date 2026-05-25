/// <reference types="vite/client" />

import type {
  AppSettings,
  ChatChunk,
  ChatDone,
  ChatRequest,
  PetDescriptor,
} from "./types";

declare global {
  interface Window {
    desktopPet: {
      getSettings: () => Promise<AppSettings>;
      saveSettings: (settings: Partial<AppSettings>) => Promise<AppSettings>;
      listPets: () => Promise<PetDescriptor[]>;
      sendChat: (request: ChatRequest) => Promise<{ ok: boolean; error?: string }>;
      setClickThrough: (enabled: boolean) => Promise<AppSettings>;
      setAlwaysOnTop: (enabled: boolean) => Promise<AppSettings>;
      resizePet: (size: number) => Promise<AppSettings>;
      startWindowDrag: (point: { screenX: number; screenY: number }) => Promise<void>;
      moveWindowDrag: (point: { screenX: number; screenY: number }) => Promise<void>;
      endWindowDrag: () => Promise<void>;
      hideWindow: () => Promise<void>;
      quitApp: () => Promise<void>;
      onChatChunk: (callback: (payload: ChatChunk) => void) => () => void;
      onChatDone: (callback: (payload: ChatDone) => void) => () => void;
    };
  }
}
