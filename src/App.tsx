import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  getAnimationSequence,
  getBackgroundPosition,
} from "./petAnimation";
import type {
  AppSettings,
  ChatDone,
  ChatMessage,
  PetDescriptor,
  PetState,
} from "./types";

const fallbackSettings: AppSettings = {
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

const builtInPet: PetDescriptor = {
  id: "builtin-spark",
  displayName: "Spark",
  description: "A tiny built-in companion.",
  spritesheetUrl: null,
  isBuiltIn: true,
};

interface PetDragState {
  pointerId: number;
  startScreenX: number;
  startScreenY: number;
  lastScreenX: number;
  moved: boolean;
}

function getDesktopApi() {
  return window.desktopPet;
}

function builtInSpritesheetDataUrl(): string {
  const cellW = 192;
  const cellH = 208;
  const columns = 8;
  const rows = 9;
  const rowColors = [
    "#42f5c8",
    "#58a6ff",
    "#76e070",
    "#f4d35e",
    "#ff8fab",
    "#ff5a5f",
    "#f6c177",
    "#9bdbff",
    "#b8f25a",
  ];

  const frames = Array.from({ length: rows * columns }, (_, index) => {
    const row = Math.floor(index / columns);
    const col = index % columns;
    const x = col * cellW;
    const y = row * cellH;
    const bob = Math.round(Math.sin((col / columns) * Math.PI * 2) * 8);
    const squash = row === 4 ? 8 : 0;
    const color = rowColors[row];
    const eyeY = y + 90 + bob;
    const bodyY = y + 64 + bob + squash;

    return `
      <g transform="translate(${x} ${y})">
        <ellipse cx="96" cy="${bodyY + 82}" rx="48" ry="8" fill="rgba(0,0,0,0.13)"/>
        <path d="M61 ${bodyY + 70} C48 ${bodyY + 26} 66 ${bodyY} 96 ${bodyY} C126 ${bodyY} 144 ${bodyY + 26} 131 ${bodyY + 70} C123 ${bodyY + 98} 69 ${bodyY + 98} 61 ${bodyY + 70}Z" fill="${color}" stroke="#151a1f" stroke-width="7" stroke-linejoin="round"/>
        <circle cx="78" cy="${eyeY}" r="6" fill="#151a1f"/>
        <circle cx="114" cy="${eyeY}" r="6" fill="#151a1f"/>
        <path d="M86 ${eyeY + 22} Q96 ${eyeY + 30} 106 ${eyeY + 22}" fill="none" stroke="#151a1f" stroke-width="5" stroke-linecap="round"/>
        <path d="M56 ${bodyY + 72} Q36 ${bodyY + 54} 42 ${bodyY + 36}" fill="none" stroke="#151a1f" stroke-width="7" stroke-linecap="round"/>
        <path d="M136 ${bodyY + 72} Q156 ${bodyY + 54} 150 ${bodyY + 36}" fill="none" stroke="#151a1f" stroke-width="7" stroke-linecap="round"/>
        <circle cx="${52 + col * 2}" cy="${bodyY + 24}" r="5" fill="#fff" opacity="0.65"/>
      </g>`;
  }).join("");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1536" height="1872" viewBox="0 0 1536 1872">${frames}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function useTimedPetState(defaultState: PetState) {
  const [state, setState] = useState<PetState>(defaultState);
  const timerRef = useRef<number | null>(null);

  const setTransientState = (next: PetState, durationMs = 1400) => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
    }
    setState(next);
    timerRef.current = window.setTimeout(() => setState(defaultState), durationMs);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  return { state, setState, setTransientState };
}

function PetSprite({
  size,
  spritesheetUrl,
  state,
}: {
  size: number;
  spritesheetUrl: string;
  state: PetState;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const frames = getAnimationSequence(state, reducedMotion);
    let frameIndex = 0;
    let timeoutId: number | null = null;

    const tick = () => {
      const frame = frames[frameIndex];
      element.style.backgroundPosition = getBackgroundPosition(frame);
      frameIndex = (frameIndex + 1) % frames.length;
      timeoutId = window.setTimeout(tick, frame.frameDurationMs);
    };

    tick();
    return () => {
      if (timeoutId != null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [state]);

  return (
    <div
      ref={ref}
      className="pet-sprite"
      style={{
        width: size,
        backgroundImage: `url("${spritesheetUrl}")`,
      }}
      aria-label="Desktop pet"
    />
  );
}

function App() {
  const [settings, setSettings] = useState<AppSettings>(fallbackSettings);
  const [pets, setPets] = useState<PetDescriptor[]>([builtInPet]);
  const [chatOpen, setChatOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [contextMenuOpen, setContextMenuOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [bubbleReply, setBubbleReply] = useState("");
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const petDragRef = useRef<PetDragState | null>(null);
  const assistantReplyRef = useRef("");
  const completedRequestIdsRef = useRef(new Set<string>());
  const { state, setState, setTransientState } = useTimedPetState("idle");

  const selectedPet = useMemo(
    () => pets.find((pet) => pet.id === settings.selectedPetId) ?? pets[0] ?? builtInPet,
    [pets, settings.selectedPetId],
  );
  const spritesheetUrl = selectedPet.spritesheetUrl ?? builtInSpritesheetDataUrl();

  useEffect(() => {
    const api = getDesktopApi();
    Promise.all([api.getSettings(), api.listPets()])
      .then(([loadedSettings, loadedPets]) => {
        setSettings(loadedSettings);
        setPets(loadedPets.length > 0 ? loadedPets : [builtInPet]);
        setTransientState("waving", 2200);
      })
      .catch(() => {
        setError("Desktop bridge did not initialize.");
      });
  }, []);

  useEffect(() => {
    const api = getDesktopApi();
    const offChunk = api.onChatChunk((payload) => {
      if (payload.requestId !== activeRequestId) {
        return;
      }
      assistantReplyRef.current += payload.delta;
      setBubbleReply(assistantReplyRef.current);
    });
    const offDone = api.onChatDone((payload: ChatDone) => {
      if (payload.requestId !== activeRequestId) {
        return;
      }
      if (completedRequestIdsRef.current.has(payload.requestId)) {
        return;
      }
      completedRequestIdsRef.current.add(payload.requestId);
      setActiveRequestId(null);
      if (!payload.ok) {
        setError(payload.error ?? "Chat request failed.");
        setBubbleReply(payload.error ?? "Chat request failed.");
        setState("failed");
        return;
      }
      const reply = assistantReplyRef.current;
      if (reply.trim().length > 0) {
        setMessages((current) => [...current, { role: "assistant", content: reply }]);
        setBubbleReply(reply);
      }
      setTransientState("review", 1800);
    });
    return () => {
      offChunk();
      offDone();
    };
  }, [activeRequestId, setState, setTransientState]);

  useEffect(() => {
    if (activeRequestId != null) {
      setState("running");
    }
  }, [activeRequestId, setState]);

  useEffect(() => {
    if (!contextMenuOpen) {
      return;
    }

    const closeMenu = () => setContextMenuOpen(false);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setContextMenuOpen(false);
      }
    };

    window.addEventListener("click", closeMenu);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("click", closeMenu);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [contextMenuOpen]);

  const saveSettings = async (next: Partial<AppSettings>) => {
    const saved = await getDesktopApi().saveSettings({ ...settings, ...next });
    setSettings(saved);
  };

  const submitChat = async (event: FormEvent) => {
    event.preventDefault();
    const text = input.trim();
    if (text.length === 0 || activeRequestId != null) {
      return;
    }

    setError(null);
    setInput("");
    const requestId = crypto.randomUUID();
    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: text }];
    completedRequestIdsRef.current.delete(requestId);
    assistantReplyRef.current = "";
    setMessages(nextMessages);
    setBubbleReply("");
    setActiveRequestId(requestId);
    await getDesktopApi().sendChat({ requestId, messages: nextMessages });
  };

  const endPetDrag = (pointerId: number) => {
    const drag = petDragRef.current;
    if (drag == null || drag.pointerId !== pointerId) {
      return;
    }

    petDragRef.current = null;
    getDesktopApi().endWindowDrag();
    if (drag.moved) {
      setTransientState("idle", 300);
      return;
    }

    setChatOpen((open) => !open);
    setContextMenuOpen(false);
    setTransientState("jumping");
  };

  return (
    <main className="shell">
      <section className="pet-zone">
        {bubbleReply.trim().length > 0 && (
          <div className={`speech-bubble no-drag ${error ? "error" : ""}`}>
            <button
              type="button"
              className="speech-bubble-close"
              aria-label="Close bubble"
              onClick={() => {
                setBubbleReply("");
                setError(null);
              }}
            >
              x
            </button>
            <div className="speech-bubble-content">{bubbleReply}</div>
          </div>
        )}

        <button
          className="pet-button no-drag"
          type="button"
          onPointerDown={(event) => {
            if (event.button !== 0) {
              return;
            }

            event.currentTarget.setPointerCapture(event.pointerId);
            petDragRef.current = {
              pointerId: event.pointerId,
              startScreenX: event.screenX,
              startScreenY: event.screenY,
              lastScreenX: event.screenX,
              moved: false,
            };
            getDesktopApi().startWindowDrag({
              screenX: event.screenX,
              screenY: event.screenY,
            });
            setContextMenuOpen(false);
            setTransientState("jumping", 800);
          }}
          onPointerMove={(event) => {
            const drag = petDragRef.current;
            if (drag == null || drag.pointerId !== event.pointerId) {
              return;
            }

            const distanceX = event.screenX - drag.startScreenX;
            const distanceY = event.screenY - drag.startScreenY;
            if (!drag.moved && Math.hypot(distanceX, distanceY) < 4) {
              return;
            }

            const directionState =
              event.screenX >= drag.lastScreenX ? "running-right" : "running-left";
            drag.moved = true;
            drag.lastScreenX = event.screenX;
            setState(directionState);
            getDesktopApi().moveWindowDrag({
              screenX: event.screenX,
              screenY: event.screenY,
            });
          }}
          onPointerUp={(event) => {
            endPetDrag(event.pointerId);
          }}
          onPointerCancel={(event) => {
            endPetDrag(event.pointerId);
          }}
          onContextMenu={(event) => {
            event.preventDefault();
            petDragRef.current = null;
            getDesktopApi().endWindowDrag();
            setContextMenuOpen((open) => !open);
            setTransientState("waving", 1000);
          }}
          onPointerEnter={() => {
            if (petDragRef.current == null) {
              setTransientState("jumping", 900);
            }
          }}
        >
          <PetSprite
            size={settings.petSize}
            spritesheetUrl={spritesheetUrl}
            state={state}
          />
        </button>

        {contextMenuOpen && (
          <div className="pet-context-menu no-drag" role="menu" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setChatOpen((open) => !open);
                setContextMenuOpen(false);
              }}
            >
              {chatOpen ? "Close chat" : "Open chat"}
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setHistoryOpen((open) => !open);
                setContextMenuOpen(false);
              }}
            >
              {historyOpen ? "Close history" : "History"}
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setSettingsOpen((open) => !open);
                setContextMenuOpen(false);
              }}
            >
              {settingsOpen ? "Close settings" : "Settings"}
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setContextMenuOpen(false);
                getDesktopApi().hideWindow();
              }}
            >
              Hide pet
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setContextMenuOpen(false);
                getDesktopApi().quitApp();
              }}
            >
              Quit
            </button>
          </div>
        )}
      </section>

      {chatOpen && (
        <section className="chat-panel no-drag">
          <form className="chat-form" onSubmit={submitChat}>
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={settings.apiKey ? "Message your pet" : "Add API key in settings"}
              disabled={activeRequestId != null}
            />
          </form>
        </section>
      )}

      {historyOpen && (
        <section className="panel history-panel no-drag">
          <header>
            <strong>History</strong>
            <button type="button" onClick={() => setHistoryOpen(false)}>
              Done
            </button>
          </header>

          <div className="history-messages">
            {messages.length === 0 ? (
              <p className="history-empty">No conversation yet.</p>
            ) : (
              messages.map((message, index) => (
                <div className={`history-message ${message.role}`} key={`${message.role}-${index}`}>
                  <span>{message.role === "user" ? "You" : selectedPet.displayName}</span>
                  <p>{message.content}</p>
                </div>
              ))
            )}
          </div>
        </section>
      )}

      {settingsOpen && (
        <section className="panel settings-panel no-drag">
          <header>
            <strong>Settings</strong>
            <button type="button" onClick={() => setSettingsOpen(false)}>
              Done
            </button>
          </header>

          <label>
            Pet
            <select
              value={settings.selectedPetId}
              onChange={(event) => saveSettings({ selectedPetId: event.target.value })}
            >
              {pets.map((pet) => (
                <option key={pet.id} value={pet.id}>
                  {pet.displayName}
                </option>
              ))}
            </select>
          </label>

          <label>
            API key
            <input
              type="password"
              value={settings.apiKey}
              onChange={(event) => setSettings({ ...settings, apiKey: event.target.value })}
              onBlur={() => saveSettings({ apiKey: settings.apiKey })}
              placeholder="sk-..."
            />
          </label>

          <label>
            Base URL
            <input
              value={settings.baseURL}
              onChange={(event) => setSettings({ ...settings, baseURL: event.target.value })}
              onBlur={() => saveSettings({ baseURL: settings.baseURL })}
            />
          </label>

          <label>
            Model
            <input
              value={settings.model}
              onChange={(event) => setSettings({ ...settings, model: event.target.value })}
              onBlur={() => saveSettings({ model: settings.model })}
            />
          </label>

          <label>
            System prompt
            <textarea
              value={settings.systemPrompt}
              onChange={(event) => setSettings({ ...settings, systemPrompt: event.target.value })}
              onBlur={() => saveSettings({ systemPrompt: settings.systemPrompt })}
            />
          </label>

          <label>
            Size
            <input
              type="range"
              min="80"
              max="224"
              value={settings.petSize}
              onChange={(event) => {
                const petSize = Number(event.target.value);
                setSettings({ ...settings, petSize });
                getDesktopApi().resizePet(petSize).then(setSettings);
              }}
            />
          </label>

          <div className="toggles">
            <label>
              <input
                type="checkbox"
                checked={settings.alwaysOnTop}
                onChange={(event) =>
                  getDesktopApi().setAlwaysOnTop(event.target.checked).then(setSettings)
                }
              />
              Always on top
            </label>
            <label>
              <input
                type="checkbox"
                checked={settings.clickThrough}
                onChange={(event) =>
                  getDesktopApi().setClickThrough(event.target.checked).then(setSettings)
                }
              />
              Click through
            </label>
          </div>
        </section>
      )}
    </main>
  );
}

export default App;
