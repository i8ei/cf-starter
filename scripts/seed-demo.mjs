#!/usr/bin/env node

import { scryptSync, randomBytes } from "node:crypto";
import { parseArgs } from "node:util";
import { printReport } from "./lib/cli-report.mjs";
import { buildSeedDemoPlan } from "./lib/seed-demo.mjs";
import { execWrangler, getPrimaryD1DatabaseName, readWranglerConfig } from "./lib/wrangler-config.mjs";

const { values } = parseArgs({
  options: {
    json: { type: "boolean" },
    plan: { type: "boolean" },
    remote: { type: "boolean" },
    "include-credentials": { type: "boolean" },
    email: { type: "string" },
    password: { type: "string" },
    name: { type: "string" },
  },
});

const email = values.email ?? "demo@example.com";
const password = values.password ?? "demo1234";
const name = values.name ?? "Demo User";
const organizationName = `${name} Workspace`;
const organizationSlug = `demo-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "workspace"}`;
const mode = values.remote ? "--remote" : "--local";

/**
 * Hash password using scrypt (compatible with Better Auth's default algorithm).
 * Format: salt:N:r:p:derivedKey (all hex-encoded)
 */
function hashPasswordForBetterAuth(plainTextPassword) {
  const salt = randomBytes(16);
  const N = 16384;
  const r = 8;
  const p = 1;
  const keyLen = 64;
  const derived = scryptSync(plainTextPassword, salt, keyLen, { N, r, p });
  return `${salt.toString("hex")}:${N}:${r}:${p}:${derived.toString("hex")}`;
}

function escapeSql(value) {
  return value.replaceAll("'", "''");
}

const { config } = await readWranglerConfig();
const dbName = getPrimaryD1DatabaseName(config);
if (!dbName) {
  console.error("d1_databases[0].database_name not found in wrangler.jsonc");
  process.exit(1);
}

const planReport = buildSeedDemoPlan({
  mode,
  email,
  name,
  organizationName,
  organizationSlug,
  config,
  includeCredentials: Boolean(values["include-credentials"]),
  password,
});

if (values.plan) {
  printReport(planReport, { json: values.json });
  process.exit(0);
}

const userId = crypto.randomUUID();
const accountId = crypto.randomUUID();
const orgId = "default-org";
const memberId = crypto.randomUUID();
const passwordHash = hashPasswordForBetterAuth(password);
const nowUnix = Math.floor(Date.now() / 1000);

const sql = [
  "BEGIN TRANSACTION;",
  // Upsert user (Better Auth user table)
  `INSERT INTO user (id, name, email, email_verified, created_at, updated_at, role)
   VALUES ('${userId}', '${escapeSql(name)}', '${escapeSql(email)}', 1, ${nowUnix}, ${nowUnix}, 'admin')
   ON CONFLICT(email) DO UPDATE SET
     name = excluded.name,
     email_verified = excluded.email_verified,
     role = excluded.role,
     updated_at = excluded.updated_at;`,
  // Delete existing credential account for this user, then insert fresh.
  // This ensures idempotency since account has no unique on (provider_id, user_id).
  `DELETE FROM account
   WHERE provider_id = 'credential'
     AND user_id = (SELECT id FROM user WHERE email = '${escapeSql(email)}');`,
  `INSERT INTO account (id, account_id, provider_id, user_id, password, created_at, updated_at)
   SELECT '${accountId}', u.id, 'credential', u.id, '${passwordHash}', ${nowUnix}, ${nowUnix}
   FROM user u WHERE u.email = '${escapeSql(email)}';`,
  // Upsert organization (Better Auth organization table)
  `INSERT INTO organization (id, name, slug, created_at)
   VALUES ('${orgId}', '${escapeSql(organizationName)}', '${escapeSql(organizationSlug)}', ${nowUnix})
   ON CONFLICT(slug) DO UPDATE SET name = excluded.name;`,
  // Ensure membership (Better Auth member table)
  `INSERT OR IGNORE INTO member (id, organization_id, user_id, role, created_at)
   SELECT '${memberId}', organization.id, user.id, 'owner', ${nowUnix}
   FROM organization, user
   WHERE organization.slug = '${escapeSql(organizationSlug)}'
     AND user.email = '${escapeSql(email)}';`,
  "COMMIT;",
].join("\n");

const result = execWrangler(["d1", "execute", dbName, mode, "--command", sql], {
  stdio: values.json ? "pipe" : "inherit",
});

if (result.error) {
  if (values.json) {
    printReport(
      {
        ok: false,
        command: "db seed-demo",
        mode: "apply",
        target: mode === "--remote" ? "remote" : "local",
        summary: ["Wrangler failed to start."],
        checks: [],
        warnings: [],
        nextSteps: ["Verify Wrangler is installed and rerun the command."],
        error: {
          code: "wrangler_spawn_failed",
          message: result.error.message,
        },
      },
      { json: true }
    );
  } else {
    console.error(result.error.message);
  }
  process.exit(1);
}

if ((result.status ?? 1) !== 0) {
  if (values.json) {
    const report = {
      ...planReport,
      ok: false,
      mode: "apply",
      summary: [`Demo seed failed for ${mode === "--remote" ? "remote" : "local"} D1.`],
      artifacts: {
        ...planReport.artifacts,
        stdout: result.stdout?.trim() ?? "",
        stderr: result.stderr?.trim() ?? "",
      },
    };
    printReport(report, { json: true });
  }
  process.exit(result.status ?? 1);
}

if (values.json) {
  const report = {
    ...planReport,
    mode: "apply",
    summary: [`Demo seed applied to ${mode === "--remote" ? "remote" : "local"} D1.`],
    nextSteps:
      mode === "--remote"
        ? ["Deploy or verify the remote app with the seeded demo account."]
        : ["Start the app and log in with the seeded demo account."],
    artifacts: {
      ...planReport.artifacts,
      stdout: result.stdout?.trim() ?? "",
      stderr: result.stderr?.trim() ?? "",
    },
  };
  printReport(report, { json: true });
  process.exit(0);
}

console.log("");
console.log("Demo seed applied.");
console.log(`Email: ${email}`);
console.log(`Password: ${password}`);
console.log(`Organization: ${organizationName}`);
