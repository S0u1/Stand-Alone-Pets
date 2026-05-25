import OpenAI from "openai";
import type { AppSettings } from "./config";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export class MissingApiKeyError extends Error {
  constructor() {
    super("Add an API key in settings before chatting.");
    this.name = "MissingApiKeyError";
  }
}

export interface ChatDebugMeta {
  requestId?: string;
}

function logJson(label: string, value: unknown): void {
  console.info(label);
  console.info(JSON.stringify(value, null, 2));
}

export function getIncrementalDelta(currentText: string, incomingText: string): string {
  if (incomingText.length === 0 || incomingText === currentText) {
    return "";
  }

  if (incomingText.startsWith(currentText)) {
    return incomingText.slice(currentText.length);
  }

  if (currentText.endsWith(incomingText)) {
    return "";
  }

  const maxOverlap = Math.min(currentText.length, incomingText.length);
  for (let overlap = maxOverlap; overlap > 0; overlap -= 1) {
    if (currentText.endsWith(incomingText.slice(0, overlap))) {
      return incomingText.slice(overlap);
    }
  }

  return incomingText;
}

export async function streamChatCompletion(
  settings: AppSettings,
  messages: ChatMessage[],
  onDelta: (delta: string) => void,
  debugMeta: ChatDebugMeta = {},
): Promise<string> {
  if (settings.apiKey.trim().length === 0) {
    throw new MissingApiKeyError();
  }

  const client = new OpenAI({
    apiKey: settings.apiKey,
    baseURL: settings.baseURL,
  });

  const requestBody = {
    model: settings.model,
    messages,
    stream: true,
    temperature: 0.7,
  } as const;

  logJson("[Stand_Alone_Pets][LLM request]", {
    requestId: debugMeta.requestId ?? null,
    baseURL: settings.baseURL,
    apiKeyConfigured: settings.apiKey.trim().length > 0,
    body: requestBody,
  });

  const stream = await client.chat.completions.create(requestBody);

  let fullText = "";
  let chunkCount = 0;
  for await (const chunk of stream) {
    chunkCount += 1;
    logJson("[Stand_Alone_Pets][LLM stream chunk]", {
      requestId: debugMeta.requestId ?? null,
      chunk,
    });

    const delta = chunk.choices[0]?.delta?.content ?? "";
    if (delta.length > 0) {
      const incrementalDelta = getIncrementalDelta(fullText, delta);
      if (incrementalDelta.length > 0) {
        fullText += incrementalDelta;
        onDelta(incrementalDelta);
      } else {
        logJson("[Stand_Alone_Pets][LLM duplicate stream chunk ignored]", {
          requestId: debugMeta.requestId ?? null,
          currentLength: fullText.length,
          incomingLength: delta.length,
        });
      }
    }
  }

  if (fullText.length === 0) {
    logJson("[Stand_Alone_Pets][LLM empty stream]", {
      requestId: debugMeta.requestId ?? null,
      chunkCount,
      note: "No content was received from the streaming response. Retrying once without stream.",
    });

    const fallbackRequestBody = {
      model: settings.model,
      messages,
      stream: false,
      temperature: 0.7,
    } as const;

    logJson("[Stand_Alone_Pets][LLM fallback request]", {
      requestId: debugMeta.requestId ?? null,
      baseURL: settings.baseURL,
      body: fallbackRequestBody,
    });

    const fallbackResponse =
      await client.chat.completions.create(fallbackRequestBody);
    const fallbackText = fallbackResponse.choices[0]?.message?.content ?? "";
    logJson("[Stand_Alone_Pets][LLM fallback response meta]", {
      requestId: debugMeta.requestId ?? null,
      id: fallbackResponse.id,
      model: fallbackResponse.model,
      created: fallbackResponse.created,
      finishReason: fallbackResponse.choices[0]?.finish_reason ?? null,
      contentLength: fallbackText.length,
      usage: fallbackResponse.usage ?? null,
    });

    fullText = fallbackText;
    if (fullText.length > 0) {
      onDelta(fullText);
    }
  }

  logJson("[Stand_Alone_Pets][LLM final response]", {
    requestId: debugMeta.requestId ?? null,
    text: fullText,
  });

  return fullText;
}
