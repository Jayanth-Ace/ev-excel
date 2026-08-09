import type { BrowserProviderRegistration } from "./browser-model-runtime.js";

const DIRECT_OLLAMA_BASE_URL = "http://127.0.0.1:11434";

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
