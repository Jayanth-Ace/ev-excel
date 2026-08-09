import assert from "node:assert/strict";
import { test } from "node:test";
import { buildOfficeDebuggingStopArgs } from "../scripts/stop-args.mjs";

void test("stop targets EV's manifest and desktop debugging session", () => {
  assert.deepEqual(buildOfficeDebuggingStopArgs("/workspace/manifest.xml"), [
    "office-addin-debugging",
    "stop",
    "/workspace/manifest.xml",
    "desktop",
  ]);
});
