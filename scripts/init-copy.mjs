#!/usr/bin/env node
/**
 * init-copy — Initialise a new project copied from cf-starter.
 *
 * What it does:
 *   1. Replace "cf-starter" references with the new app name
 *   2. Create D1 database via wrangler and write database_id into wrangler.jsonc
 *   3. Set CORS_ORIGIN / APP_BASE_URL to the production Workers URL
 *   4. Clean old migrations → db:generate → db:migrate → seed:demo
 *
 * Usage:
 *   cp -r cf-starter my-app && cd my-app && npm install && npm run init
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

const ROOT = path.resolve(import.meta.dirname, "..");

// ────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────

function ask(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Replace all occurrences of `from` with `to` in a file. Returns true if the file was modified. */
function replaceInFile(filePath, from, to) {
  const abs = path.resolve(ROOT, filePath);
  if (!fs.existsSync(abs)) return false;
  const original = fs.readFileSync(abs, "utf-8");
  const updated = original.replaceAll(from, to);
  if (updated === original) return false;
  fs.writeFileSync(abs, updated, "utf-8");
  return true;
}

function run(cmd, args = [], opts = {}) {
  return spawnSync(cmd, args, { cwd: ROOT, encoding: "utf-8", stdio: "pipe", ...opts });
}

function runOrDie(cmd, args, label) {
  const result = run(cmd, args, { stdio: "inherit" });
  if (result.status !== 0) {
    console.error(`\n✗ ${label} failed (exit ${result.status})`);
    process.exit(1);
  }
}

// ────────────────────────────────────────────
// D1 creation
// ────────────────────────────────────────────

function createD1Database(dbName) {
  console.log(`\nCreating D1 database "${dbName}" ...`);
  const result = run("npx", ["wrangler", "d1", "create", dbName]);
  if (result.status !== 0) {
    // Already exists? Try to get id from list
    const listResult = run("npx", ["wrangler", "d1", "list", "--json"]);
    if (listResult.status === 0) {
      try {
        const databases = JSON.parse(listResult.stdout);
        const existing = databases.find((db) => db.name === dbName);
        if (existing) {
          console.log(`✓ D1 database "${dbName}" already exists (${existing.uuid})`);
          return existing.uuid;
        }
      } catch { /* ignore parse errors */ }
    }
    console.error(`✗ Failed to create D1 database. stderr:\n${result.stderr}`);
    console.error("  You can create it manually: npx wrangler d1 create " + dbName);
    return null;
  }

  // Parse database_id from output like: database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
  const match = result.stdout.match(/database_id\s*=\s*"([0-9a-f-]+)"/);
  if (!match) {
    // Try JSON output format
    const jsonMatch = result.stdout.match(/"uuid"\s*:\s*"([0-9a-f-]+)"/);
    if (jsonMatch) {
      console.log(`✓ Created D1 database (${jsonMatch[1]})`);
      return jsonMatch[1];
    }
    console.error("✗ Could not parse database_id from wrangler output:");
    console.error(result.stdout);
    return null;
  }

  console.log(`✓ Created D1 database (${match[1]})`);
  return match[1];
}

function writeD1DatabaseId(databaseId) {
  const wranglerPath = path.resolve(ROOT, "wrangler.jsonc");
  const content = fs.readFileSync(wranglerPath, "utf-8");
  const updated = content.replace(/"database_id"\s*:\s*"TODO"/, `"database_id": "${databaseId}"`);
  if (updated === content) {
    console.log("- database_id already set (not TODO)");
    return false;
  }
  fs.writeFileSync(wranglerPath, updated, "utf-8");
  console.log("✓ Wrote database_id into wrangler.jsonc");
  return true;
}

// ────────────────────────────────────────────
// Production URL
// ────────────────────────────────────────────

function setProdUrls(appName) {
  const prodUrl = `https://${appName}.ichevi.workers.dev`;
  const wranglerPath = path.resolve(ROOT, "wrangler.jsonc");
  let content = fs.readFileSync(wranglerPath, "utf-8");

  // Replace CORS_ORIGIN
  content = content.replace(
    /("CORS_ORIGIN"\s*:\s*)"http:\/\/localhost:5173"/,
    `$1"http://localhost:5173, ${prodUrl}"`
  );

  // Replace APP_BASE_URL — set to prod URL (overridable via .dev.vars for local)
  content = content.replace(
    /("APP_BASE_URL"\s*:\s*)"http:\/\/localhost:5173"/,
    `$1"${prodUrl}"`
  );

  fs.writeFileSync(wranglerPath, content, "utf-8");
  console.log(`✓ Set CORS_ORIGIN to include ${prodUrl}`);
  console.log(`✓ Set APP_BASE_URL to ${prodUrl}`);

  // Create .dev.vars with local overrides if it doesn't exist
  const devVarsPath = path.resolve(ROOT, ".dev.vars");
  if (!fs.existsSync(devVarsPath)) {
    fs.writeFileSync(
      devVarsPath,
      `# Local development overrides\nAPP_BASE_URL=http://localhost:5173\n`,
      "utf-8"
    );
    console.log("✓ Created .dev.vars with local APP_BASE_URL override");
  }
}

// ────────────────────────────────────────────
// Migration cleanup
// ────────────────────────────────────────────

function cleanMigrations() {
  const migrationsDir = path.resolve(ROOT, "migrations");
  if (!fs.existsSync(migrationsDir)) {
    console.log("- No migrations directory found");
    return;
  }

  const entries = fs.readdirSync(migrationsDir);
  let cleaned = 0;
  for (const entry of entries) {
    const full = path.join(migrationsDir, entry);
    const stat = fs.statSync(full);
    if (stat.isFile() && entry.endsWith(".sql")) {
      fs.unlinkSync(full);
      cleaned++;
    }
  }

  // Also clean meta/*.sql snapshot files
  const metaDir = path.join(migrationsDir, "meta");
  if (fs.existsSync(metaDir)) {
    for (const entry of fs.readdirSync(metaDir)) {
      if (entry.endsWith(".sql")) {
        fs.unlinkSync(path.join(metaDir, entry));
      }
    }
  }

  // Reset meta/_journal.json
  if (!fs.existsSync(metaDir)) {
    fs.mkdirSync(metaDir, { recursive: true });
  }
  const journalPath = path.join(metaDir, "_journal.json");
  fs.writeFileSync(
    journalPath,
    JSON.stringify({ version: "7", dialect: "sqlite", entries: [] }, null, 2) + "\n",
    "utf-8"
  );

  if (cleaned > 0) {
    console.log(`✓ Cleaned ${cleaned} old migration(s)`);
  } else {
    console.log("- No migrations to clean");
  }
}

// ────────────────────────────────────────────
// Demo / example cleanup
// ────────────────────────────────────────────

function removeDemo() {
  // Delete demo files
  const demoFiles = [
    "src/routes/public-example.ts",
    "app/pages/DemoPage.tsx",
  ];
  for (const rel of demoFiles) {
    const abs = path.resolve(ROOT, rel);
    if (fs.existsSync(abs)) {
      fs.unlinkSync(abs);
      console.log(`✓ Deleted ${rel}`);
    }
  }

  // Remove public-example import and route from src/index.ts
  const indexPath = path.resolve(ROOT, "src/index.ts");
  if (fs.existsSync(indexPath)) {
    let content = fs.readFileSync(indexPath, "utf-8");
    // Remove import line
    content = content.replace(/^import publicExample.*\n/m, "");
    // Remove .route("/api/public/example", publicExample) — with or without trailing semicolon
    content = content.replace(/\s*\.route\("\/api\/public\/example",\s*publicExample\)[;]?/g, "");
    fs.writeFileSync(indexPath, content, "utf-8");
    console.log("✓ Removed public-example route from src/index.ts");
  }

  // Remove DemoPage import and /p/demo route from app/App.tsx
  const appPath = path.resolve(ROOT, "app/App.tsx");
  if (fs.existsSync(appPath)) {
    let content = fs.readFileSync(appPath, "utf-8");
    // Remove lazy import line
    content = content.replace(/^const DemoPage = lazy\(.*\n/m, "");
    // Remove the /p/demo Route block (multiline)
    content = content.replace(
      /\s*<Route path="\/p\/demo">[\s\S]*?<\/Route>\n?/,
      "\n"
    );
    // Remove lazy/Suspense imports if no longer used
    if (!content.includes("lazy(") && !content.includes("Suspense")) {
      content = content.replace(
        /import \{ lazy, Suspense \} from "react";\n/,
        ""
      );
    }
    fs.writeFileSync(appPath, content, "utf-8");
    console.log("✓ Removed DemoPage route from app/App.tsx");
  }
}

// ────────────────────────────────────────────
// Main
// ────────────────────────────────────────────

async function main() {
  const raw = await ask("? New app name: ");
  if (!raw) {
    console.error("App name is required.");
    process.exit(1);
  }
  const appName = slugify(raw);
  if (!appName) {
    console.error("Invalid app name after normalisation.");
    process.exit(1);
  }

  const OLD = "cf-starter";
  const dbName = `${appName}-db`;

  console.log(`\nInitialising "${appName}" ...\n`);

  // ── Step 1: Replace references ──
  console.log("── Replacing references ──");
  const targets = [
    { file: "package.json", label: "package.json" },
    { file: "wrangler.jsonc", label: "wrangler.jsonc" },
    { file: "index.html", label: "index.html" },
    { file: "app/components/AppShell.tsx", label: "AppShell.tsx" },
    { file: "app/components/PublicShell.tsx", label: "PublicShell.tsx" },
    { file: "app/pages/HomePage.tsx", label: "HomePage.tsx" },
    { file: "src/lib/email.ts", label: "email.ts" },
    { file: "CLAUDE.md", label: "CLAUDE.md" },
    { file: "README.md", label: "README.md" },
  ];

  for (const t of targets) {
    const changed = replaceInFile(t.file, OLD, appName);
    if (changed) {
      console.log(`✓ Updated ${t.label}`);
    } else {
      console.log(`- Skipped ${t.label} (no changes needed)`);
    }
  }

  // Rename CLI entry script: scripts/cf-starter.mjs → scripts/{appName}.mjs
  const oldScript = path.resolve(ROOT, "scripts", `${OLD}.mjs`);
  const newScript = path.resolve(ROOT, "scripts", `${appName}.mjs`);
  if (fs.existsSync(oldScript) && !fs.existsSync(newScript)) {
    fs.renameSync(oldScript, newScript);
    console.log(`✓ Renamed scripts/${OLD}.mjs → scripts/${appName}.mjs`);
  } else if (fs.existsSync(newScript)) {
    console.log(`- scripts/${appName}.mjs already exists`);
  } else {
    console.log(`⚠ scripts/${OLD}.mjs not found — skip rename`);
  }

  // ── Verify wrangler is working ──
  const wranglerCheck = run("npx", ["wrangler", "--version"]);
  if (wranglerCheck.status !== 0) {
    console.log("⚠ wrangler not working, reinstalling node_modules...");
    run("rm", ["-rf", "node_modules"], { stdio: "inherit" });
    runOrDie("npm", ["install"], "npm install");
  }

  // ── Step 2: Create D1 database ──
  console.log("\n── D1 database ──");
  const databaseId = createD1Database(dbName);
  if (databaseId) {
    writeD1DatabaseId(databaseId);
  } else {
    console.log("⚠ Skipping database_id write. Set it manually in wrangler.jsonc.");
  }

  // ── Step 3: Set production URLs ──
  console.log("\n── Production URLs ──");
  setProdUrls(appName);

  // ── Step 4: Remove demo/example files ──
  console.log("\n── Removing demo files ──");
  removeDemo();

  // ── Step 5: Clean migrations → generate → migrate → seed ──
  console.log("\n── Database setup ──");
  cleanMigrations();

  console.log("\nGenerating fresh migrations from schema ...");
  runOrDie("npx", ["drizzle-kit", "generate"], "db:generate");
  console.log("✓ Generated migrations");

  console.log("\nApplying migrations to local D1 ...");
  runOrDie("npm", ["run", "db:migrate"], "db:migrate");
  console.log("✓ Migrated local D1");

  console.log("\nSeeding demo data ...");
  runOrDie("npm", ["run", "seed:demo"], "seed:demo");
  console.log("✓ Seeded demo data");

  // ── Done ──
  console.log(`
✅ "${appName}" is ready!

  npm run dev        Start development
  npm run deploy     Deploy to Cloudflare

──────────────────────────────────────────────
🔒 Security checklist (before going public)
──────────────────────────────────────────────
  [ ] Set ADMIN_PASSWORD to a strong value (8+ chars) in .dev.vars & wrangler.jsonc
  [ ] Set BETTER_AUTH_SECRET to a random 32+ char string
  [ ] Verify CORS_ORIGIN only lists your domains (no wildcards)
  [ ] Confirm AUTH_MODE is not "none" if handling private data
  [ ] Run "npm run security-check" before first deploy
  [ ] Review API routes: ensure all mutations check ownership/role
──────────────────────────────────────────────
`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
