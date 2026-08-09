/** Build identity injected into the task-pane HTML for local diagnostics. */
export const EV_BUILD_ID =
  typeof document === "undefined"
    ? "unknown-dev-build"
    : document.querySelector('meta[name="ev-build-id"]')?.getAttribute("content") ?? "unknown-dev-build";
