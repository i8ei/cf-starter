#!/usr/bin/env node
/**
 * init-copy — Initialise a new project copied from cf-starter.
 *
 * Replaces "cf-starter" references and cleans up template migrations so the
 * copy is ready for its own development.
 *
 * Usage:
 *   node scripts/init-copy.mjs
 */

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

  // 1. Replace in target files
  const targets = [
    { file: "package.json", label: "package.json" },
    { file: "wrangler.jsonc", label: "wrangler.jsonc" },
    { file: "app/components/AppShell.tsx", label: "AppShell.tsx" },
    { file: "app/pages/HomePage.tsx", label: "HomePage.tsx" },
    { file: "src/lib/email.ts", label: "email.ts" },
  ];

  for (const t of targets) {
    const changed = replaceInFile(t.file, OLD, appName);
    if (changed) {
      console.log(`\u2713 Updated ${t.label}`);
    } else {
      console.log(`- Skipped ${t.label} (no changes needed)`);
    }
  }

  // 2. Clean old migrations
  const migrationsDir = path.resolve(ROOT, "migrations");
  if (fs.existsSync(migrationsDir)) {
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

    // Reset meta/_journal.json if it exists; otherwise create it
    const metaDir = path.join(migrationsDir, "meta");
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
      console.log(`\u2713 Cleaned ${cleaned} old migration(s)`);
    } else {
      console.log("- No migrations to clean");
    }
  } else {
    console.log("- No migrations directory found");
  }

  // 3. Print next steps
  console.log(`
Next steps:
  1. npm install
  2. npm run db:migrate
  3. npm run seed:demo
  4. npm run dev
`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
