import fs from "node:fs";
import https from "node:https";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { URL } from "node:url";

function isLoopbackHost(hostname) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

export function currentBuildId(repoRoot) {
  try {
    const commit = execFileSync("git", ["rev-parse", "--short=12", "HEAD"], { cwd: repoRoot, encoding: "utf8" }).trim();
    const dirty = execFileSync("git", ["status", "--porcelain"], { cwd: repoRoot, encoding: "utf8" }).trim().length > 0;
    return `${commit}${dirty ? "-dirty" : ""}`;
  } catch {
    return "unknown-dev-build";
  }
}

/** Fetch a local HTTPS development URL without weakening any non-local request. */
export function requestLocalHttps(url, timeoutMs = 5_000) {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || !isLoopbackHost(parsed.hostname)) {
    throw new Error(`Local health checks only allow loopback HTTPS URLs: ${url}`);
  }

  return new Promise((resolve) => {
    const request = https.request(url, {
      method: "GET",
      agent: new https.Agent({ rejectUnauthorized: false }),
      timeout: timeoutMs,
    }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      response.on("end", () => resolve({
        ok: (response.statusCode ?? 0) >= 200 && (response.statusCode ?? 0) < 400,
        statusCode: response.statusCode ?? 0,
        contentType: response.headers["content-type"] ?? "",
        body: Buffer.concat(chunks).toString("utf8"),
      }));
    });
    request.on("error", (error) => resolve({ ok: false, statusCode: 0, contentType: "", body: "", error: error.message }));
    request.on("timeout", () => request.destroy(new Error(`Timed out after ${timeoutMs}ms`)));
    request.end();
  });
}

export async function waitForLocalHttps(url, attempts = 40, delayMs = 250) {
  let lastResult;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    lastResult = await requestLocalHttps(url);
    if (lastResult.ok) return lastResult;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return lastResult ?? { ok: false, statusCode: 0, contentType: "", body: "", error: "No request was attempted." };
}

export function readManifestSourceLocation(manifestPath) {
  const xml = fs.readFileSync(manifestPath, "utf8");
  const match = xml.match(/<SourceLocation\s+DefaultValue="([^"]+)"\s*\/>/u);
  if (!match?.[1]) throw new Error(`Manifest has no DefaultSettings SourceLocation: ${manifestPath}`);
  return { xml, sourceLocation: match[1] };
}

function readManifestId(manifestPath) {
  const xml = fs.readFileSync(manifestPath, "utf8");
  const match = xml.match(/<Id>([^<]+)<\/Id>/u);
  if (!match?.[1]) throw new Error(`Manifest has no Id: ${manifestPath}`);
  return match[1];
}

export function macSideloadManifestPath(repoRoot, homeDirectory = os.homedir()) {
  const manifestPath = path.join(repoRoot, "manifest.xml");
  return path.join(homeDirectory, "Library", "Containers", "com.microsoft.Excel", "Data", "Documents", "wef", `${readManifestId(manifestPath)}.manifest.xml`);
}

export function inspectMacSideloadManifest(repoRoot, expectedSourceLocation) {
  const manifestPath = macSideloadManifestPath(repoRoot);
  if (!fs.existsSync(manifestPath)) {
    return { present: false, matches: false, manifestPath, sourceLocation: null };
  }

  try {
    const manifest = readManifestSourceLocation(manifestPath);
    return {
      present: true,
      matches: manifest.sourceLocation === expectedSourceLocation,
      manifestPath,
      sourceLocation: manifest.sourceLocation,
    };
  } catch {
    return { present: true, matches: false, manifestPath, sourceLocation: null };
  }
}

function listeningProcessIds(port) {
  try {
    return execFileSync("lsof", [`-tiTCP:${port}`, "-sTCP:LISTEN"], { encoding: "utf8" })
      .split(/\s+/u)
      .map((value) => Number.parseInt(value, 10))
      .filter((value) => Number.isInteger(value) && value > 0);
  } catch {
    return [];
  }
}

/** Stop only a Vite process running from this EV checkout on the dev port. */
export function stopOwnedDevServer(repoRoot, port = 3141) {
  const expectedVite = path.join(repoRoot, "node_modules", "vite", "bin", "vite.js");
  const processIds = listeningProcessIds(port);
  if (processIds.length === 0) return { stopped: false, owned: false };

  const owned = processIds.every((pid) => {
    try {
      const command = execFileSync("ps", ["-p", String(pid), "-o", "command="], { encoding: "utf8" });
      return command.includes(expectedVite) && command.includes(`--port ${port}`);
    } catch {
      return false;
    }
  });
  if (!owned) return { stopped: false, owned: false };

  for (const pid of processIds) {
    try { process.kill(pid, "SIGTERM"); } catch { /* process exited between inspection and signal */ }
  }
  return { stopped: true, owned: true };
}

export async function inspectDevServer(repoRoot, origin = "https://localhost:3141") {
  const manifestPath = path.join(repoRoot, "manifest.xml");
  const manifest = readManifestSourceLocation(manifestPath);
  const taskpaneUrl = `${origin}/src/taskpane.html`;
  const taskpane = await requestLocalHttps(taskpaneUrl);
  const taskpaneScript = taskpane.body.match(/<script[^>]+type="module"[^>]+src="([^"]+)"/u)?.[1];
  const scriptUrl = taskpaneScript ? new URL(taskpaneScript, taskpaneUrl).toString() : null;
  const script = scriptUrl ? await requestLocalHttps(scriptUrl) : { ok: false, statusCode: 0, body: "", contentType: "", error: "Taskpane module URL not found." };
  const buildId = currentBuildId(repoRoot);
  const htmlBuildId = taskpane.body.match(/<meta\s+name="ev-build-id"\s+content="([^"]+)"\s*\/?>/u)?.[1] ?? null;
  const assets = await Promise.all([
    `${origin}/assets/icon-16.png`,
    `${origin}/assets/icon-32.png`,
    `${origin}/assets/icon-80.png`,
  ].map((url) => requestLocalHttps(url)));

  return {
    sourceMatches: manifest.sourceLocation === taskpaneUrl,
    buildId,
    htmlBuildId,
    buildMatches: htmlBuildId === buildId,
    sourceLocation: manifest.sourceLocation,
    taskpane,
    script,
    assets,
    taskpaneUrl,
  };
}
