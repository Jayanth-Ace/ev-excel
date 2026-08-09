export type ProviderErrorKind =
  | "authentication"
  | "permission"
  | "rate_limit"
  | "transient"
  | "invalid_request"
  | "network"
  | "unknown";

/** Classify provider failures for actionable UI without retrying blindly. */
export function classifyProviderError(provider: string, message: string): ProviderErrorKind {
  const normalizedProvider = provider.toLowerCase();
  const normalizedMessage = message.toLowerCase();

  if (
    normalizedMessage.includes("401")
    || normalizedMessage.includes("unauthorized")
    || normalizedMessage.includes("invalid api key")
    || normalizedMessage.includes("authentication")
    || (normalizedProvider.includes("google") && normalizedMessage.includes("login"))
  ) return "authentication";

  if (
    normalizedMessage.includes("403")
    || normalizedMessage.includes("forbidden")
    || normalizedMessage.includes("permission")
    || normalizedMessage.includes("project id")
    || normalizedMessage.includes("permission_denied")
  ) return "permission";

  if (normalizedMessage.includes("429") || normalizedMessage.includes("rate limit")) {
    return "rate_limit";
  }

  if (
    normalizedMessage.includes("400")
    || normalizedMessage.includes("invalid argument")
    || normalizedMessage.includes("invalid request")
    || normalizedMessage.includes("unsupported model")
    || normalizedMessage.includes("not found")
  ) return "invalid_request";

  if (
    normalizedMessage.includes("502")
    || normalizedMessage.includes("503")
    || normalizedMessage.includes("504")
    || normalizedMessage.includes("temporarily unavailable")
    || normalizedMessage.includes("timeout")
    || normalizedMessage.includes("overloaded")
  ) return "transient";

  if (
    normalizedMessage.includes("failed to fetch")
    || normalizedMessage.includes("networkerror")
    || normalizedMessage.includes("load failed")
    || normalizedMessage.includes("cors")
  ) return "network";

  return "unknown";
}
