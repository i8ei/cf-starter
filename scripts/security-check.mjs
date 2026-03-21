#!/usr/bin/env node
/**
 * security-check — Pre-deploy security audit for cf-starter apps.
 *
 * Checks for common security misconfigurations that should be fixed
 * before deploying to production. Run automatically during `npm run deploy`,
 * or manually via `npm run security-check`.
 *
 * Exit codes:
 *   0 — all checks passed (or warnings only)
 *   1 — blocking issues found (deploy should be stopped)
 */

import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { readWranglerConfig } from "./lib/wrangler-config.mjs";

const { values } = parseArgs({
  options: {
    json: { type: "boolean" },
  },
});

const ROOT = process.cwd();

// ── Check definitions ──────────────────────────

const checks = [];

function block(id, message) {
  checks.push({ id, level: "block", message });
}

function warn(id, message) {
  checks.push({ id, level: "warn", message });
}

function pass(id, message) {
  checks.push({ id, level: "pass", message });
}

// ── Run checks ──────────────────────────────────

const { config } = await readWranglerConfig(ROOT);
const vars = config?.vars ?? {};
const authMode = vars.AUTH_MODE ?? "better-auth";

// 1. Demo routes still present
const demoFiles = [
  "src/routes/public-example.ts",
  "app/pages/DemoPage.tsx",
];
const remainingDemo = demoFiles.filter((f) => fs.existsSync(path.resolve(ROOT, f)));
if (remainingDemo.length > 0) {
  warn("demo-routes", `Demo files still exist: ${remainingDemo.join(", ")}. Remove before production.`);
} else {
  pass("demo-routes", "No demo/example files found");
}

// 2. AUTH_MODE=none with sensitive data risk
if (authMode === "none") {
  warn("auth-mode-none", 'AUTH_MODE is "none" — all data is publicly accessible. Set to "simple-admin" or "better-auth" if handling private data.');
} else {
  pass("auth-mode", `AUTH_MODE is "${authMode}"`);
}

// 3. ADMIN_PASSWORD strength (simple-admin mode)
if (authMode === "simple-admin") {
  const pw = vars.ADMIN_PASSWORD;
  if (!pw || pw === "TODO" || pw === "changeme") {
    block("admin-password", "ADMIN_PASSWORD is not set or uses a placeholder. Set a strong password (8+ chars).");
  } else if (pw.length < 8) {
    block("admin-password", `ADMIN_PASSWORD is only ${pw.length} chars. Use 8+ characters.`);
  } else {
    pass("admin-password", "ADMIN_PASSWORD is configured");
  }
}

// 4. BETTER_AUTH_SECRET (better-auth mode)
if (authMode === "better-auth") {
  const secret = vars.BETTER_AUTH_SECRET;
  if (!secret || secret === "TODO" || secret === "changeme") {
    block("better-auth-secret", "BETTER_AUTH_SECRET is not set or uses a placeholder. Generate a random 32+ char string.");
  } else if (secret.length < 32) {
    warn("better-auth-secret", `BETTER_AUTH_SECRET is only ${secret.length} chars. Recommend 32+ characters.`);
  } else {
    pass("better-auth-secret", "BETTER_AUTH_SECRET is configured");
  }
}

// 5. CORS_ORIGIN check
const corsOrigin = vars.CORS_ORIGIN ?? "";
if (corsOrigin === "*") {
  block("cors-wildcard", "CORS_ORIGIN is set to '*'. This allows any website to access your API. Restrict to your domains.");
} else if (!corsOrigin || corsOrigin === "http://localhost:5173") {
  warn("cors-origin", "CORS_ORIGIN only allows localhost. Add your production domain.");
} else {
  pass("cors-origin", "CORS_ORIGIN is configured");
}

// 6. COOKIE_SECURE
const cookieSecure = vars.COOKIE_SECURE;
if (cookieSecure === "false") {
  warn("cookie-secure", 'COOKIE_SECURE is "false". Cookies will be sent over HTTP. Set to "true" for production.');
} else {
  pass("cookie-secure", "COOKIE_SECURE is not disabled");
}

// 7. D1 database_id still TODO
const dbId = config?.d1_databases?.[0]?.database_id;
if (!dbId || dbId === "TODO") {
  block("d1-database", "D1 database_id is not set. Run `npm run init` or create manually.");
} else {
  pass("d1-database", "D1 database is configured");
}

// 8. Check for hardcoded secrets in source
const secretPatterns = [
  { file: "src/index.ts", pattern: /ADMIN_PASSWORD\s*[:=]\s*["'][^"']+["']/i },
  { file: "src/index.ts", pattern: /BETTER_AUTH_SECRET\s*[:=]\s*["'][^"']+["']/i },
];
const hardcodedSecrets = secretPatterns.filter(({ file, pattern }) => {
  const filePath = path.resolve(ROOT, file);
  if (!fs.existsSync(filePath)) return false;
  return pattern.test(fs.readFileSync(filePath, "utf-8"));
});
if (hardcodedSecrets.length > 0) {
  block("hardcoded-secrets", "Secrets found hardcoded in source code. Move to wrangler.jsonc vars or .dev.vars.");
} else {
  pass("hardcoded-secrets", "No hardcoded secrets detected in source");
}

// 9. Rate limiter binding
const hasDO = config?.durable_objects?.bindings?.some((b) => b.name === "RATE_LIMITER");
if (!hasDO) {
  warn("rate-limiter", "RATE_LIMITER Durable Object not configured. Auth endpoints will not be rate-limited.");
} else {
  pass("rate-limiter", "RATE_LIMITER Durable Object is configured");
}

// ── Report ──────────────────────────────────────

const blocks = checks.filter((c) => c.level === "block");
const warns = checks.filter((c) => c.level === "warn");
const passes = checks.filter((c) => c.level === "pass");

if (values.json) {
  console.log(JSON.stringify({ ok: blocks.length === 0, checks }, null, 2));
} else {
  console.log("\n🔒 Security Check\n");

  for (const c of checks) {
    const icon = c.level === "block" ? "✗" : c.level === "warn" ? "⚠" : "✓";
    const color = c.level === "block" ? "\x1b[31m" : c.level === "warn" ? "\x1b[33m" : "\x1b[32m";
    console.log(`  ${color}${icon}\x1b[0m ${c.message}`);
  }

  console.log("");

  if (blocks.length > 0) {
    console.log(`\x1b[31m  ✗ ${blocks.length} blocking issue(s) found. Fix before deploying.\x1b[0m\n`);
  } else if (warns.length > 0) {
    console.log(`\x1b[33m  ⚠ ${warns.length} warning(s). Review before deploying.\x1b[0m\n`);
  } else {
    console.log(`\x1b[32m  ✓ All ${passes.length} checks passed.\x1b[0m\n`);
  }
}

process.exit(blocks.length > 0 ? 1 : 0);
