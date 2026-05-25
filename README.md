# Stand_Alone_Pets

<img src="assets/stand-alone-pets-icon.png" alt="Stand_Alone_Pets icon" width="96" />

Stand_Alone_Pets is an independent desktop pet app built with Electron, React, Vite, and TypeScript. It floats above the desktop, supports local pet sprite packs, and can connect to OpenAI-compatible chat completion APIs so each pet can reply through an on-screen speech bubble.

## Features

- Frameless transparent desktop pet window
- Right-click pet menu for chat, history, settings, hide, and quit
- Single-input chat flow with pet replies shown as speech bubbles
- Conversation history panel
- OpenAI-compatible API settings: base URL, model, API key, and system prompt
- Automatic prompt injection with the selected pet's name and description
- Local pet pack discovery from `~/.codex/pets`
- Drag animation states for moving the pet
- Click-through and always-on-top settings
- Debug logging for LLM request parameters, stream chunks, and final responses

## Tech Stack

- Electron for the desktop shell
- React for the renderer UI
- Vite for local development and frontend builds
- TypeScript for app, renderer, and Electron code
- Vitest for unit tests
- OpenAI SDK for OpenAI-compatible chat completions

## Getting Started

Install dependencies:

```bash
npm install
```

Run the app in development mode:

```bash
npm run dev
```

Run tests:

```bash
npm test
```

Run type checks:

```bash
npm run typecheck
```

Build the renderer and Electron main process:

```bash
npm run build
```

## LLM Configuration

Open the app settings from the pet's right-click menu and configure:

- API Key
- Base URL, for example `https://api.openai.com/v1`
- Model, for example `gpt-4.1-mini`
- System prompt

The API key is stored in the app's local Electron user data directory, not in this repository. The app logs whether an API key is configured, but it does not print the key itself.

The request sent to the model automatically prepends the current pet identity:

```text
Current desktop pet identity:
- Name: <pet display name>
- Description: <pet description>
```

## Custom Pet Packs

The app discovers local pet packs from:

```text
${CODEX_HOME:-~/.codex}/pets
```

Each pet should live in its own folder with a `pet.json` manifest:

```json
{
  "id": "my-pet",
  "displayName": "My Pet",
  "description": "A short personality description.",
  "spritesheetPath": "spritesheet.png"
}
```

The spritesheet is expected to follow the Codex pet atlas layout used by this app: 8 columns by 9 rows. If no local pet pack is available, the app falls back to the built-in Spark pet.

## Project Structure

```text
assets/              App icon assets
electron/            Electron main process, preload bridge, config, pets, LLM calls
src/                 React renderer UI and pet animation logic
tests/               Unit tests
```

## Privacy Notes

- Do not commit local settings files or API keys.
- Runtime settings are written outside the repository in Electron's user data directory.
- LLM debug logs include prompts, messages, chunks, and final responses. Avoid committing terminal logs if conversations contain private content.
