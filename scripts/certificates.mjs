import crypto from "node:crypto";
import fs from "node:fs";

/** Validate the local certificate pair used by the Office development server. */
export function validateDevCertificates(certPath, keyPath, now = new Date()) {
  if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
    return { valid: false, reason: "Missing cert.pem or key.pem. Generate trusted local certificates with: mkcert localhost" };
  }

  try {
    const certificate = new crypto.X509Certificate(fs.readFileSync(certPath));
    const privateKey = crypto.createPrivateKey(fs.readFileSync(keyPath));
    const certificateKey = certificate.publicKey.export({ type: "spki", format: "der" });
    const privateKeyPublic = crypto.createPublicKey(privateKey).export({ type: "spki", format: "der" });

    if (!certificateKey.equals(privateKeyPublic)) {
      return { valid: false, reason: "cert.pem and key.pem do not belong to the same key pair." };
    }
    if (now < new Date(certificate.validFrom) || now > new Date(certificate.validTo)) {
      return { valid: false, reason: `The development certificate is not valid on ${now.toISOString()}. Generate a new pair with: mkcert localhost` };
    }
    if (!certificate.checkHost("localhost")) {
      return { valid: false, reason: "The development certificate does not include localhost in its subject alternative names. Generate a new pair with: mkcert localhost" };
    }
    return { valid: true, reason: "valid" };
  } catch (error) {
    return {
      valid: false,
      reason: `Invalid development certificate pair: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
