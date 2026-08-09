import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { validateDevCertificates } from "../scripts/certificates.mjs";

test("certificate validation reports missing development files", () => {
  const result = validateDevCertificates("/tmp/ev-missing-cert.pem", "/tmp/ev-missing-key.pem");
  assert.equal(result.valid, false);
  assert.match(result.reason, /Missing cert\.pem/);
});

test("certificate validation rejects malformed PEM data", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "ev-cert-test-"));
  const certPath = path.join(directory, "cert.pem");
  const keyPath = path.join(directory, "key.pem");
  fs.writeFileSync(certPath, "not a certificate");
  fs.writeFileSync(keyPath, "not a key");
  const result = validateDevCertificates(certPath, keyPath);
  assert.equal(result.valid, false);
  assert.match(result.reason, /Invalid development certificate/);
  fs.rmSync(directory, { recursive: true, force: true });
});

test("certificate validation rejects a mismatched private key", { skip: !fs.existsSync("cert.pem") }, () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "ev-cert-test-"));
  const keyPath = path.join(directory, "key.pem");
  const generated = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
  fs.writeFileSync(keyPath, generated.privateKey.export({ type: "pkcs8", format: "pem" }));
  const result = validateDevCertificates("cert.pem", keyPath);
  assert.equal(result.valid, false);
  assert.match(result.reason, /same key pair/);
  fs.rmSync(directory, { recursive: true, force: true });
});
