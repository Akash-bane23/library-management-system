// Firebase Admin SDK initialisation shared by every serverless endpoint.
//
// Credential resolution order (first match wins):
//   1. FIREBASE_SERVICE_ACCOUNT — the whole service-account JSON in one env var
//      (most convenient on Vercel).
//   2. FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY (classic Vercel setup).
//   3. A local service-account file (GOOGLE_APPLICATION_CREDENTIALS, or the
//      `scripts/service-account.json` file already used by setup-admin.js).
//      Local development only — that file is git-ignored.
//
// FIREBASE_PROJECT_ID is reused from configuration the project already has, so
// it never has to be duplicated: FIREBASE_PROJECT_ID -> VITE_FIREBASE_PROJECT_ID
// -> GCLOUD_PROJECT/GCP_PROJECT -> `project_id` inside the service-account JSON.
//
// No secret is ever logged or returned to the browser by this module.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const SERVICE_ACCOUNT_FILENAME = "scripts/service-account.json";

// Accepts the value as it is usually pasted: with \n escapes, and sometimes
// wrapped in the surrounding quotes copied from the JSON file.
const normalizeKey = (key) => {
  let value = String(key || "").replace(/\\n/g, "\n").trim();
  if (
    value.length > 1 &&
    ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'")))
  ) {
    value = value.slice(1, -1).replace(/\\n/g, "\n").trim();
  }
  return value;
};

const projectIdFromEnv = () =>
  (
    process.env.FIREBASE_PROJECT_ID ||
    process.env.VITE_FIREBASE_PROJECT_ID ||
    process.env.GCLOUD_PROJECT ||
    process.env.GCP_PROJECT ||
    ""
  ).trim();

// Reads the whole service-account JSON from an env var, if provided.
function inlineServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed.client_email && parsed.private_key) {
      return { ...parsed, __source: "FIREBASE_SERVICE_ACCOUNT environment variable" };
    }
  } catch {
    // Ignored: reported as an invalid configuration by resolveAdminCredentials.
  }
  return null;
}

// Reads a service-account JSON file from disk (local development only).
export function loadLocalServiceAccount() {
  const candidates = [
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
    path.join(ROOT, SERVICE_ACCOUNT_FILENAME),
  ].filter(Boolean);

  for (const file of candidates) {
    try {
      if (!fs.existsSync(file)) continue;
      const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
      if (parsed.client_email && parsed.private_key) {
        return { ...parsed, __source: path.relative(ROOT, file) || file };
      }
    } catch {
      // Unreadable/invalid file: fall through to the env-var path.
    }
  }
  return null;
}

// Never returns secret values to callers that log them; `source` is safe text.
export function resolveAdminCredentials() {
  const missing = [];
  let projectId = projectIdFromEnv();
  let clientEmail = "";
  let privateKey = "";
  let source = "";

  const account = inlineServiceAccount() || loadLocalServiceAccount();

  if (account) {
    projectId = projectId || (account.project_id || "").trim();
    clientEmail = (account.client_email || "").trim();
    privateKey = normalizeKey(account.private_key);
    source = account.__source;
  } else {
    clientEmail = (process.env.FIREBASE_CLIENT_EMAIL || "").trim();
    privateKey = normalizeKey(process.env.FIREBASE_PRIVATE_KEY);
    source = "environment variables";
    if (!clientEmail) missing.push("FIREBASE_CLIENT_EMAIL");
    if (!privateKey) missing.push("FIREBASE_PRIVATE_KEY");
  }

  if (!projectId) missing.push("FIREBASE_PROJECT_ID (or VITE_FIREBASE_PROJECT_ID)");

  return { projectId, clientEmail, privateKey, source, missing };
}

// The Firebase Web API key is public configuration; it is reused from the
// frontend config when the server-side copy is not set.
export function resolveWebApiKey() {
  return (
    process.env.FIREBASE_API_KEY ||
    process.env.VITE_FIREBASE_API_KEY ||
    ""
  ).trim();
}

export function getMissingServerEnv() {
  const { missing } = resolveAdminCredentials();
  const extra = resolveWebApiKey() ? [] : ["FIREBASE_API_KEY (or VITE_FIREBASE_API_KEY)"];
  return [...missing, ...extra];
}

// Initialises (or reuses) the Admin app. Throws errors with a `code` of
// "server/misconfigured" or "server/invalid-key" — never with key material.
export function getFirebaseAdminApp() {
  const existing = getApps();
  if (existing.length > 0) return existing[0];

  const { projectId, clientEmail, privateKey, missing } = resolveAdminCredentials();
  if (missing.length > 0) {
    const error = new Error(
      `Server is not configured. Missing environment variables: ${missing.join(", ")}.`
    );
    error.code = "server/misconfigured";
    throw error;
  }

  try {
    crypto.createPrivateKey(privateKey);
  } catch {
    const error = new Error(
      "FIREBASE_PRIVATE_KEY is not a valid PEM private key. Keep the BEGIN/END lines and the \\n escapes."
    );
    error.code = "server/invalid-key";
    throw error;
  }

  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
    projectId,
  });
}

export function getAdminServices() {
  const app = getFirebaseAdminApp();
  return { app, auth: getAuth(app), db: getFirestore(app) };
}
