import fs from "node:fs";
import https from "node:https";
import path from "node:path";
import { URL } from "node:url";

function isLoopbackHost(hostname) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
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

export async function inspectDevServer(repoRoot, origin = "https://localhost:3141") {
  const manifestPath = path.join(repoRoot, "manifest.xml");
  const manifest = readManifestSourceLocation(manifestPath);
  const taskpaneUrl = `${origin}/src/taskpane.html`;
  const taskpane = await requestLocalHttps(taskpaneUrl);
  const taskpaneScript = taskpane.body.match(/<script[^>]+type="module"[^>]+src="([^"]+)"/u)?.[1];
  const scriptUrl = taskpaneScript ? new URL(taskpaneScript, taskpaneUrl).toString() : null;
  const script = scriptUrl ? await requestLocalHttps(scriptUrl) : { ok: false, statusCode: 0, body: "", contentType: "", error: "Taskpane module URL not found." };
  const assets = await Promise.all([
    `${origin}/assets/icon-16.png`,
    `${origin}/assets/icon-32.png`,
    `${origin}/assets/icon-80.png`,
  ].map((url) => requestLocalHttps(url)));

  return {
    sourceMatches: manifest.sourceLocation === taskpaneUrl,
    sourceLocation: manifest.sourceLocation,
    taskpane,
    script,
    assets,
    taskpaneUrl,
  };
}
