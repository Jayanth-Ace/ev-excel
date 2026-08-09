/** Return the arguments used to stop EV's desktop Office debugging session. */
export function buildOfficeDebuggingStopArgs(manifestPath) {
  return ["office-addin-debugging", "stop", manifestPath, "desktop"];
}
