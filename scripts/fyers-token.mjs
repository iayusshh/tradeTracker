#!/usr/bin/env node
/**
 * Fyers daily access-token helper.
 *
 * Usage (run once each morning):
 *   node scripts/fyers-token.mjs <auth_code>
 *
 * Where <auth_code> is the JWT you get from the Fyers login redirect URL.
 * The script exchanges it for an access_token and patches .env automatically.
 *
 * Fyers login URL (open in browser):
 *   https://api-t1.fyers.in/api/v3/generate-authcode?client_id=<APP_ID>&redirect_uri=https://127.0.0.1/&response_type=code&state=xyz
 */

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = resolve(__dirname, "../.env");

// Load .env manually (no external deps needed)
function loadEnv(path) {
  const vars = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    vars[key] = val;
  }
  return vars;
}

function patchEnv(path, key, value) {
  const content = readFileSync(path, "utf8");
  const regex = new RegExp(`^(${key}=).*$`, "m");
  const updated = regex.test(content)
    ? content.replace(regex, `$1${value}`)
    : content + `\n${key}=${value}`;
  writeFileSync(path, updated, "utf8");
}

const authCode = process.argv[2];
if (!authCode) {
  console.error("Usage: node scripts/fyers-token.mjs <auth_code>");
  console.error("\nGet your auth code by opening this URL in a browser:");
  const env = loadEnv(ENV_PATH);
  const appId = env.FYERS_APP_ID || "<FYERS_APP_ID>";
  console.error(
    `  https://api-t1.fyers.in/api/v3/generate-authcode?client_id=${appId}&redirect_uri=https://127.0.0.1/&response_type=code&state=xyz`
  );
  console.error("\nAfter login, copy the full JWT from the redirect URL's ?code= param.");
  process.exit(1);
}

const env = loadEnv(ENV_PATH);
const appId = env.FYERS_APP_ID;
const secretKey = env.FYERS_SECRET_ID;

if (!appId || !secretKey) {
  console.error("FYERS_APP_ID and FYERS_SECRET_ID must be set in .env");
  process.exit(1);
}

const appIdHash = createHash("sha256")
  .update(`${appId}:${secretKey}`)
  .digest("hex");

console.log("Exchanging auth code for access token...");

const res = await fetch("https://api-t1.fyers.in/api/v3/validate-authcode", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    grant_type: "authorization_code",
    appIdHash,
    code: authCode,
  }),
});

const json = await res.json();

if (json.s !== "ok" || !json.access_token) {
  console.error("Failed to get access token:", JSON.stringify(json, null, 2));
  process.exit(1);
}

patchEnv(ENV_PATH, "FYERS_ACCESS_TOKEN", json.access_token);
console.log("✓ FYERS_ACCESS_TOKEN updated in .env");
console.log(`  Refresh token: ${json.refresh_token ?? "n/a"}`);
