import { contextBridge, ipcRenderer } from "electron";

const api = {
  getSettings: () => ipcRenderer.invoke("settings:get"),
  saveSettings: (settings: unknown) => ipcRenderer.invoke("settings:save", settings),
  listPets: () => ipcRenderer.invoke("pets:list"),
  sendChat: (request: unknown) => ipcRenderer.invoke("chat:send", request),
  setClickThrough: (enabled: boolean) =>
    ipcRenderer.invoke("window:set-click-through", enabled),
  setAlwaysOnTop: (enabled: boolean) =>
    ipcRenderer.invoke("window:set-always-on-top", enabled),
  resizePet: (size: number) => ipcRenderer.invoke("window:resize-pet", size),
  startWindowDrag: (point: { screenX: number; screenY: number }) =>
    ipcRenderer.invoke("window:drag-start", point),
  moveWindowDrag: (point: { screenX: number; screenY: number }) =>
    ipcRenderer.invoke("window:drag-move", point),
  endWindowDrag: () => ipcRenderer.invoke("window:drag-end"),
  hideWindow: () => ipcRenderer.invoke("window:hide"),
  quitApp: () => ipcRenderer.invoke("app:quit"),
  onChatChunk: (callback: (payload: unknown) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: unknown) => callback(payload);
    ipcRenderer.on("chat:chunk", listener);
    return () => ipcRenderer.removeListener("chat:chunk", listener);
  },
  onChatDone: (callback: (payload: unknown) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: unknown) => callback(payload);
    ipcRenderer.on("chat:done", listener);
    return () => ipcRenderer.removeListener("chat:done", listener);
  },
};

contextBridge.exposeInMainWorld("desktopPet", api);
