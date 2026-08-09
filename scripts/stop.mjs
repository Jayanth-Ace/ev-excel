#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import path from "node:path";
import { buildOfficeDebuggingStopArgs } from "./stop-args.mjs";

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);
const manifestPath = path.join(repoRoot, "manifest.xml");

const result = spawnSync("npx", buildOfficeDebuggingStopArgs(manifestPath), {
  cwd: repoRoot,
  stdio: "inherit",
  shell: process.platform === "win32",
});
process.exitCode = result.status ?? 1;
