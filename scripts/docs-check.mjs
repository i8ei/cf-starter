#!/usr/bin/env node
/**
 * docs-check — Guard against CLAUDE.md bloat.
 *
 * CLAUDE.md is loaded in full into every AI session of every derived app,
 * so its size is a recurring token cost. This warns (does not fail) when it
 * grows past a byte budget — a better proxy for context cost than line count,
 * especially with Japanese (multi-byte) text.
 *
 * Template-only: derived apps naturally accrete app-specific context, so this
 * is not wired into ci:local. Run manually or in the template's own CI.
 *
 * Exit codes: 0 always (advisory). Use --strict to fail on overflow.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";

const { values } = parseArgs({ options: { strict: { type: "boolean" }, json: { type: "boolean" } } });

const ROOT = process.cwd();
// The lean post-split baseline is ~11KB (invariants, footguns, security musts —
// all genuinely always-relevant). Budget gives modest headroom so the guard
// catches drift toward the old ~38KB, not the healthy trimmed state.
const BUDGET_BYTES = 13000;

const target = resolve(ROOT, "CLAUDE.md");
if (!existsSync(target)) {
  console.error("CLAUDE.md not found");
  process.exit(0);
}

const bytes = Buffer.byteLength(readFileSync(target, "utf-8"), "utf-8");
const over = bytes > BUDGET_BYTES;
const pct = Math.round((bytes / BUDGET_BYTES) * 100);

if (values.json) {
  console.log(JSON.stringify({ ok: !over, bytes, budget: BUDGET_BYTES, pct }, null, 2));
} else if (over) {
  console.log(
    `\x1b[33m⚠ CLAUDE.md is ${bytes} bytes (${pct}% of the ${BUDGET_BYTES}-byte budget).\x1b[0m`
  );
  console.log("  Move task-specific detail into docs/ and keep only always-relevant knowledge.");
} else {
  console.log(`\x1b[32m✓ CLAUDE.md is ${bytes} bytes (${pct}% of budget).\x1b[0m`);
}

process.exit(over && values.strict ? 1 : 0);
