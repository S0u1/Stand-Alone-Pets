import { app, BrowserWindow, ipcMain, Menu, nativeImage, net, protocol, Tray } from "electron";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildPetSystemPrompt, JsonConfigStore, sanitizeSettings } from "./config";
import { builtInPet, discoverPets } from "./pets";
import { streamChatCompletion, type ChatMessage } from "./llm";

protocol.registerSchemesAsPrivileged([
  {
    scheme: "pet-asset",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
    },
  },
]);

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let configStore: JsonConfigStore;
let petAssetMap = new Map<string, string>();
let windowDragState: { offsetX: number; offsetY: number } | null = null;

const APP_NAME = "Stand_Alone_Pets";

function getPreloadPath(): string {
  return path.join(__dirname, "preload.js");
}

function getRendererUrl(): string {
  return process.env.ELECTRON_RENDERER_URL ?? pathToFileURL(path.join(__dirname, "../dist/index.html")).toString();
}

function getAppIconPath(): string {
  return path.join(__dirname, "../assets/stand-alone-pets-icon.png");
}

function applyWindowInteraction(settings = configStore.get()): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  mainWindow.setAlwaysOnTop(settings.alwaysOnTop, "floating");
  mainWindow.setIgnoreMouseEvents(settings.clickThrough, { forward: true });
}

function createWindow(): BrowserWindow {
  const settings = configStore.get();
  const window = new BrowserWindow({
    title: APP_NAME,
    width: 380,
    height: 560,
    minWidth: 260,
    minHeight: 320,
    frame: false,
    transparent: true,
    hasShadow: false,
    resizable: false,
    show: false,
    skipTaskbar: true,
    alwaysOnTop: settings.alwaysOnTop,
    backgroundColor: "#00000000",
    icon: getAppIconPath(),
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow = window;
  window.setVisibleOnAllWorkspaces(true, {
    visibleOnFullScreen: true,
    skipTransformProcessType: true,
  });
  window.setMenuBarVisibility(false);
  window.loadURL(getRendererUrl());
  window.once("ready-to-show", () => {
    applyWindowInteraction(settings);
    window.showInactive();
  });
  window.on("closed", () => {
    mainWindow = null;
  });

  return window;
}

function createTray(): void {
  const icon = nativeImage.createFromPath(getAppIconPath()).resize({ width: 18, height: 18 });
  tray = new Tray(icon);
  tray.setToolTip(APP_NAME);
  updateTrayMenu();
}

function updateTrayMenu(): void {
  if (!tray) {
    return;
  }

  const settings = configStore.get();
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: mainWindow?.isVisible() ? `Hide ${APP_NAME}` : `Show ${APP_NAME}`,
        click: () => {
          if (!mainWindow || mainWindow.isDestroyed()) {
            createWindow();
            return;
          }
          if (mainWindow.isVisible()) {
            mainWindow.hide();
          } else {
            mainWindow.showInactive();
          }
          updateTrayMenu();
        },
      },
      {
        label: "Click Through",
        type: "checkbox",
        checked: settings.clickThrough,
        click: () => {
          const next = configStore.set({ clickThrough: !settings.clickThrough });
          applyWindowInteraction(next);
          updateTrayMenu();
        },
      },
      {
        label: "Always On Top",
        type: "checkbox",
        checked: settings.alwaysOnTop,
        click: () => {
          const next = configStore.set({ alwaysOnTop: !settings.alwaysOnTop });
          applyWindowInteraction(next);
          updateTrayMenu();
        },
      },
      { type: "separator" },
      {
        label: "Quit",
        click: () => app.quit(),
      },
    ]),
  );
}

function registerIpcHandlers(): void {
  ipcMain.handle("settings:get", () => configStore.get());
  ipcMain.handle("settings:save", (_event, input: unknown) => {
    const settings = configStore.set(sanitizeSettings(input as Record<string, unknown>));
    applyWindowInteraction(settings);
    updateTrayMenu();
    return settings;
  });
  ipcMain.handle("pets:list", () => {
    const registry = discoverPets();
    petAssetMap = registry.assetMap;
    return registry.pets;
  });
  ipcMain.handle("window:set-click-through", (_event, enabled: boolean) => {
    const settings = configStore.set({ clickThrough: Boolean(enabled) });
    applyWindowInteraction(settings);
    updateTrayMenu();
    return settings;
  });
  ipcMain.handle("window:set-always-on-top", (_event, enabled: boolean) => {
    const settings = configStore.set({ alwaysOnTop: Boolean(enabled) });
    applyWindowInteraction(settings);
    updateTrayMenu();
    return settings;
  });
  ipcMain.handle("window:resize-pet", (_event, size: number) =>
    configStore.set({ petSize: size }),
  );
  ipcMain.handle("window:drag-start", (_event, point: { screenX: number; screenY: number }) => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return;
    }
    const bounds = mainWindow.getBounds();
    windowDragState = {
      offsetX: point.screenX - bounds.x,
      offsetY: point.screenY - bounds.y,
    };
  });
  ipcMain.handle("window:drag-move", (_event, point: { screenX: number; screenY: number }) => {
    if (!mainWindow || mainWindow.isDestroyed() || windowDragState == null) {
      return;
    }
    mainWindow.setPosition(
      Math.round(point.screenX - windowDragState.offsetX),
      Math.round(point.screenY - windowDragState.offsetY),
      false,
    );
  });
  ipcMain.handle("window:drag-end", () => {
    windowDragState = null;
  });
  ipcMain.handle("window:hide", () => {
    mainWindow?.hide();
    updateTrayMenu();
  });
  ipcMain.handle("app:quit", () => app.quit());
  ipcMain.handle("chat:send", async (event, request: { requestId: string; messages: ChatMessage[] }) => {
    try {
      const settings = configStore.get();
      const registry = discoverPets();
      petAssetMap = registry.assetMap;
      const selectedPet =
        registry.pets.find((pet) => pet.id === settings.selectedPetId) ?? builtInPet;
      const messages: ChatMessage[] = [
        {
          role: "system",
          content: buildPetSystemPrompt(settings.systemPrompt, selectedPet),
        },
        ...request.messages.filter((message) => message.role !== "system"),
      ];

      await streamChatCompletion(
        settings,
        messages,
        (delta) => {
          event.sender.send("chat:chunk", { requestId: request.requestId, delta });
        },
        { requestId: request.requestId },
      );
      event.sender.send("chat:done", { requestId: request.requestId, ok: true });
      return { ok: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Chat request failed.";
      event.sender.send("chat:done", {
        requestId: request.requestId,
        ok: false,
        error: message,
      });
      return { ok: false, error: message };
    }
  });
}

function registerPetAssetProtocol(): void {
  protocol.handle("pet-asset", (request) => {
    const id = decodeURIComponent(new URL(request.url).hostname);
    const assetPath = petAssetMap.get(id);
    if (!assetPath) {
      return new Response("Pet asset not found", { status: 404 });
    }
    return net.fetch(pathToFileURL(assetPath).toString());
  });
}

app.whenReady().then(() => {
  app.setName(APP_NAME);
  if (process.platform === "darwin") {
    app.dock?.setIcon(getAppIconPath());
  }
  configStore = new JsonConfigStore(app.getPath("userData"));
  registerPetAssetProtocol();
  registerIpcHandlers();
  petAssetMap = discoverPets().assetMap;
  createWindow();
  createTray();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else {
      mainWindow?.showInactive();
    }
  });
});

app.on("window-all-closed", () => {
  // Keep the tray process alive after the floating pet window is hidden or closed.
});
