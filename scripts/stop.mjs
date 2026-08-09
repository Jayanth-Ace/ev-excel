#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const result = spawnSync("npx", ["office-addin-debugging", "stop"], { stdio: "inherit", shell: process.platform === "win32" });
process.exitCode = result.status ?? 1;
