import type { BrowserProviderRegistration } from "./browser-model-runtime.js";

const DIRECT_OLLAMA_BASE_URL = "http://127.0.0.1:11434";

function isOllamaPayload(value: DynamicValue): value is DynamicObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDynamicArray(value: DynamicValue): value is readonly DynamicValue[] {
  return Array.isArray(value);
}

function appendQwenNoThinkControl(messages: DynamicValue): DynamicValue {
  if (!isDynamicArray(messages)) return messages;

  let lastUserIndex = -1;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (isOllamaPayload(message) && message.role === "user") {
      lastUserIndex = index;
      break;
    }
  }

  if (lastUserIndex < 0) return messages;
  const message = messages[lastUserIndex];
  if (!isOllamaPayload(message) || typeof message.content !== "string") return messages;
  if (message.content.includes("/no_think")) return messages;

  const updatedMessages = [...messages];
  updatedMessages[lastUserIndex] = {
    ...message,
    content: `${message.content}\n/no_think`,
  };
  return updatedMessages;
}

/**
 * Disable Qwen's private reasoning channel while preserving the normal request
 * messages and tool definitions. Ollama otherwise returns reasoning text in a
 * separate OpenAI-compatible `reasoning` field, which the shared adapter exposes
 * as an assistant thinking block.
 */
export function disableOllamaThinking(payload: DynamicValue): DynamicValue {
  if (!isOllamaPayload(payload)) return payload;
  const existingKwargs = isOllamaPayload(payload.chat_template_kwargs)
    ? payload.chat_template_kwargs
    : {};
  return {
    ...payload,
    reasoning_effort: "none",
    // Ollama's OpenAI-compatible server does not consistently translate
    // `reasoning_effort` for Qwen models. Qwen recognizes this control token
    // in the user turn, so add it to the outbound copy rather than mutating
    // the conversation stored by EV.
    messages: appendQwenNoThinkControl(payload.messages),
    chat_template_kwargs: {
      ...existingKwargs,
      enable_thinking: false,
    },
  };
}

export interface OllamaTransportOptions {
  /** Use the same-origin HTTPS relay used by the local Excel WebView. */
  useRelay?: boolean;
  /** Allows deterministic transport selection tests without a browser global. */
  relayOrigin?: string;
}

function isSecureLoopbackBrowser(): boolean {
  if (typeof window === "undefined") return false;
  const hostname = window.location.hostname.toLowerCase();
  return window.location.protocol === "https:"
    && (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1");
}

/** Resolve the transport used by the local provider without changing providers. */
export function resolveOllamaTransport(options: OllamaTransportOptions = {}): {
  baseUrl: string;
  modelsUrl: string;
  usesRelay: boolean;
} {
  const useRelay = options.useRelay ?? isSecureLoopbackBrowser();
  if (!useRelay) {
    return {
      baseUrl: `${DIRECT_OLLAMA_BASE_URL}/v1`,
      modelsUrl: `${DIRECT_OLLAMA_BASE_URL}/api/tags`,
      usesRelay: false,
    };
  }

  const origin = options.relayOrigin
    ?? (typeof window === "undefined" ? "https://localhost:3141" : window.location.origin);
  const relayBaseUrl = `${origin.replace(/\/$/, "")}/ollama-proxy`;
  return {
    baseUrl: `${relayBaseUrl}/v1`,
    modelsUrl: `${relayBaseUrl}/api/tags`,
    usesRelay: true,
  };
}

/**
 * First-party local provider registration.
 *
 * Ollama exposes an OpenAI-compatible `/v1` API and a native `/api/tags`
 * catalogue. The provider is intentionally keyless and direct: local model
 * discovery must not send a request through a configured remote proxy.
 */
export function createOllamaProvider(options: OllamaTransportOptions = {}): BrowserProviderRegistration {
  const transport = resolveOllamaTransport(options);
  return {
    id: "ollama",
    name: "Ollama (local)",
    api: "openai-completions",
    baseUrl: transport.baseUrl,
    models: [],
    modelsUrl: transport.modelsUrl,
    discoveryFormat: "ollama",
    // The relay is local and same-origin; it is not the remote EV proxy.
    useProxy: false,
    discoveryTimeoutMs: 1_200,
    resolveApiKey: () => Promise.resolve(undefined),
    allowKeyless: true,
  };
}

/** Direct transport used by Node tests and non-browser local integrations. */
export const ollamaProvider = createOllamaProvider({ useRelay: false });
