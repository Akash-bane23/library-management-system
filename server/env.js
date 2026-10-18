// Shared environment loader for local dev tooling (never bundled into the
// browser build). Mirrors how Vite reads `.env`: KEY=VALUE lines, `export`
// prefix allowed, surrounding quotes removed.

import fs from "node:fs";

export function parseEnvFile(file) {
  const values = {};
  if (!file || !fs.existsSync(file)) return values;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length > 1) ||
      (value.startsWith("'") && value.endsWith("'") && value.length > 1)
    ) {
      value = value.slice(1, -1);
    }
    values[match[1]] = value;
  }
  return values;
}

// Loads the file into process.env without overriding values already defined in
// the real environment (so Vercel / shell variables always win).
export function loadEnvFile(file) {
  const values = parseEnvFile(file);
  for (const [key, value] of Object.entries(values)) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
  return Object.keys(values);
}

// Appends or updates KEY=VALUE lines in a file (used by `--write`).
export function upsertEnvFile(file, entries) {
  const existing = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  const lines = existing.split(/\r?\n/);
  for (const [key, value] of Object.entries(entries)) {
    const serialized = `${key}=${value}`;
    const index = lines.findIndex(
      (line) => new RegExp(`^\\s*(?:export\\s+)?${key}\\s*=`).test(line)
    );
    if (index >= 0) lines[index] = serialized;
    else lines.push(serialized);
  }
  fs.writeFileSync(file, lines.join("\n"), "utf8");
}
