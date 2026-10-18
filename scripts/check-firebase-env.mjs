#!/usr/bin/env node
// Checks (and optionally writes) the server-side Firebase Admin SDK
// configuration used by api/create-student.js and api/student-login.js.
//
//   npm run check:firebase             -> report what is configured / missing
//   npm run check:firebase -- --write  -> copy values from
//                                         scripts/service-account.json into .env
//   npm run check:firebase -- --verify -> read-only Admin SDK + Firestore check
//
// It never prints secret values and never creates or modifies data.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { loadEnvFile, upsertEnvFile } from "../server/env.js";
import {
  getFirebaseAdminApp,
  loadLocalServiceAccount,
  resolveAdminCredentials,
  resolveWebApiKey,
  SERVICE_ACCOUNT_FILENAME,
} from "../server/firebase-admin.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ENV_FILE = path.join(ROOT, ".env");
const SERVICE_ACCOUNT_FILE = path.join(ROOT, SERVICE_ACCOUNT_FILENAME);

const args = process.argv.slice(2);
const write = args.includes("--write");
const verify = args.includes("--verify");

const mask = (value, keep = 4) => {
  if (!value) return "";
  if (value.length <= keep * 2) return "*".repeat(value.length);
  return `${value.slice(0, keep)}…${value.slice(-keep)}`;
};

const describeKey = (privateKey) => {
  if (!privateKey) return "MISSING";
  try {
    const key = crypto.createPrivateKey(privateKey);
    const { asymmetricKeyType, asymmetricKeyDetails } = key;
    return `valid ${asymmetricKeyType || "RSA"} key${
      asymmetricKeyDetails?.modulusLength ? ` (${asymmetricKeyDetails.modulusLength}-bit)` : ""
    }`;
  } catch (error) {
    return `INVALID (${error.message})`;
  }
};

loadEnvFile(ENV_FILE);

const account = loadLocalServiceAccount();
const { projectId, clientEmail, privateKey, source, missing } = resolveAdminCredentials();
const apiKey = resolveWebApiKey();

console.log("Firebase Admin SDK configuration check");
console.log("--------------------------------------");
console.log(`Project root   : ${ROOT}`);
console.log(`.env           : ${fs.existsSync(ENV_FILE) ? "found" : "not found"}`);
console.log(
  `Service account: ${
    account ? `found (${account.__source})` : `not found (${SERVICE_ACCOUNT_FILENAME})`
  }`
);
console.log("");

const row = (label, ok, detail) =>
  console.log(`${label.padEnd(26)} ${(ok ? "OK" : "MISSING").padEnd(8)} ${detail}`);

row(
  "FIREBASE_PROJECT_ID",
  Boolean(projectId),
  projectId
    ? `${projectId}${process.env.FIREBASE_PROJECT_ID ? "" : "  (reused from VITE_FIREBASE_PROJECT_ID)"}`
    : "not set anywhere"
);
row(
  "FIREBASE_CLIENT_EMAIL",
  Boolean(clientEmail),
  clientEmail || "not set (comes from the service-account JSON)"
);
row("FIREBASE_PRIVATE_KEY", Boolean(privateKey), describeKey(privateKey));
row(
  "FIREBASE_API_KEY",
  Boolean(apiKey),
  apiKey
    ? `${mask(apiKey)}${process.env.FIREBASE_API_KEY ? "" : "  (reused from VITE_FIREBASE_API_KEY)"}`
    : "not set (used by api/student-login.js)"
);
console.log(`Credential source: ${source || "none"}`);
console.log("");

if (missing.length > 0) {
  const project = projectId || "<your-project-id>";
  console.log(`Result: ${missing.length} value(s) missing -> ${missing.join(", ")}`);
  console.log("");
  console.log("How to obtain them (one time, ~1 minute):");
  console.log(
    `  1. Open https://console.firebase.google.com/project/${project}/settings/serviceaccounts/adminsdk`
  );
  console.log('  2. Click "Generate new private key", then "Generate key" (downloads a .json)');
  console.log(`  3. Save that file as ${SERVICE_ACCOUNT_FILENAME} (already git-ignored)`);
  console.log("  4. Re-run this check, then either:");
  console.log("       npm run check:firebase -- --write   (writes the values into .env)");
  console.log("       npm run check:firebase -- --verify  (proves the credentials work)");
  console.log("");
  console.log("For Vercel: Project -> Settings -> Environment Variables (Production + Preview):");
  console.log("  FIREBASE_CLIENT_EMAIL = client_email from the JSON");
  console.log("  FIREBASE_PRIVATE_KEY  = private_key from the JSON (keep the \\n escapes)");
  console.log("  FIREBASE_PROJECT_ID is optional (reused from VITE_FIREBASE_PROJECT_ID).");
  process.exitCode = 1;
} else {
  console.log("Result: all required server-side values are present.");
}

if (write) {
  if (!account) {
    console.log("");
    console.log(`--write skipped: ${SERVICE_ACCOUNT_FILENAME} was not found.`);
    process.exitCode = 1;
  } else {
    const entries = {
      FIREBASE_PROJECT_ID: projectId,
      FIREBASE_CLIENT_EMAIL: clientEmail,
      FIREBASE_PRIVATE_KEY: `"${String(account.private_key).replace(/\r?\n/g, "\\n")}"`,
    };
    if (apiKey && !process.env.FIREBASE_API_KEY) entries.FIREBASE_API_KEY = apiKey;
    upsertEnvFile(ENV_FILE, entries);
    console.log("");
    console.log(`Wrote these keys to .env (git-ignored, values not shown):`);
    console.log(`  ${Object.keys(entries).join(", ")}`);
  }
}

if (verify) {
  console.log("");
  console.log("Verifying Admin SDK (read-only)...");
  if (missing.length > 0) {
    console.log("  skipped: credentials are incomplete.");
    process.exitCode = 1;
  } else {
    try {
      const app = getFirebaseAdminApp();
      const users = await getAuth(app).listUsers(1);
      const counter = await getFirestore(app).doc("counters/studentId").get();
      console.log(`  Admin SDK init: OK (project ${projectId})`);
      console.log(`  Auth access    : OK (${users.users.length} user(s) sampled)`);
      console.log(
        `  Firestore      : OK (counters/studentId ${
          counter.exists ? `= ${counter.data().value}` : "not created yet"
        })`
      );
      console.log("  No data was written.");
    } catch (error) {
      console.log(`  FAILED: ${error.code || ""} ${error.message}`);
      process.exitCode = 1;
    }
  }
}
