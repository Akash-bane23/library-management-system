#!/usr/bin/env node
// Full-stack local dev: serves /api/* with the exact handlers Vercel runs in
// production (api/*.js), and starts Vite.
//
// Why this exists: `vite` alone has no serverless runtime, so POST
// /api/create-student answered 404 and student creation failed with
// "The account service was not found". This launcher makes `npm run dev`
// run both processes without the Vercel CLI (`npx vercel dev` still works).

import { spawn } from "node:child_process";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadEnvFile } from "../server/env.js";
import {
  getMissingServerEnv,
  loadLocalServiceAccount,
  SERVICE_ACCOUNT_FILENAME,
} from "../server/firebase-admin.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const API_PORT = Number(process.env.DEV_API_PORT || 3001);
const VITE_BIN = path.join(ROOT, "node_modules", "vite", "bin", "vite.js");

loadEnvFile(path.join(ROOT, ".env"));

const missingEnv = getMissingServerEnv();
if (missingEnv.length > 0) {
  console.warn(
    `[dev-api] Missing server Firebase configuration: ${missingEnv.join(", ")}\n` +
      `[dev-api] Student creation/login will answer 500 until you provide it.\n` +
      `[dev-api] Either add the values to .env, or save the Firebase service-account JSON as ` +
      `${SERVICE_ACCOUNT_FILENAME}, then run \`npm run check:firebase\`.`
  );
} else {
  const account = loadLocalServiceAccount();
  console.log(
    `[dev-api] Firebase Admin credentials loaded from ${
      account ? account.__source : "environment variables"
    }.`
  );
}

// --- Vercel-compatible request/response shim for the api/ handlers ----------
function readBody(req) {
  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      if (!raw) return resolve(undefined);
      const type = String(req.headers["content-type"] || "");
      if (type.includes("application/json")) {
        try {
          return resolve(JSON.parse(raw));
        } catch {
          return resolve(undefined);
        }
      }
      resolve(raw);
    });
    req.on("error", () => resolve(undefined));
  });
}

function createRes(nodeRes) {
  let sent = false;
  const send = (status, body, contentType) => {
    if (sent) return;
    sent = true;
    nodeRes.statusCode = status;
    if (contentType) nodeRes.setHeader("Content-Type", contentType);
    nodeRes.end(body);
  };
  return {
    statusCode: 200,
    setHeader(name, value) {
      if (!sent) nodeRes.setHeader(name, value);
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(obj) {
      send(this.statusCode, JSON.stringify(obj), "application/json; charset=utf-8");
    },
    send(body) {
      send(this.statusCode, body);
    },
    end(body) {
      send(this.statusCode, body);
    },
  };
}

const handlerCache = new Map();
async function loadHandler(name) {
  if (handlerCache.has(name)) return handlerCache.get(name);
  const file = path.join(ROOT, "api", `${name}.js`);
  if (!fs.existsSync(file)) return null;
  const module = await import(pathToFileURL(file).href);
  handlerCache.set(name, module.default);
  return module.default;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${API_PORT}`);
  const name = url.pathname.replace(/^\/api\//, "").replace(/[^a-z0-9-]/gi, "");

  if (!url.pathname.startsWith("/api/") || !name) {
    res.statusCode = 404;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.end(JSON.stringify({ error: "Not found." }));
  }

  const handler = await loadHandler(name).catch((error) => {
    console.error(`[dev-api] Failed to load api/${name}.js:`, error.message);
    return null;
  });

  if (!handler) {
    res.statusCode = 404;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.end(JSON.stringify({ error: `Unknown endpoint /api/${name}.` }));
  }

  req.body = await readBody(req);
  try {
    await handler(req, createRes(res));
  } catch (error) {
    console.error(`[dev-api] /api/${name} crashed:`, error?.stack || error?.message || error);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ error: "Internal server error. See the dev terminal for details." }));
    }
  }
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(
      `[dev-api] Port ${API_PORT} is already in use. Stop the other process or run with DEV_API_PORT=<port>.`
    );
    process.exit(1);
  }
  throw error;
});

let vite = null;
let shuttingDown = false;

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  if (vite && !vite.killed) vite.kill();
  server.close(() => process.exit(code));
  setTimeout(() => process.exit(code), 1500).unref();
}

server.listen(API_PORT, "127.0.0.1", () => {
  console.log(`[dev-api] /api handlers listening on http://127.0.0.1:${API_PORT}`);

  if (!fs.existsSync(VITE_BIN)) {
    console.error("[dev] vite is not installed. Run `npm install` first.");
    return shutdown(1);
  }

  vite = spawn(process.execPath, [VITE_BIN], { cwd: ROOT, stdio: "inherit", env: process.env });
  vite.on("exit", (code) => shutdown(code ?? 0));
});

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
