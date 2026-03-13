import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export function stripJsoncLineComments(input) {
  let out = "";
  let inString = false;
  let escaped = false;

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    const next = input[i + 1];

    if (inString) {
      out += ch;
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      out += ch;
      continue;
    }

    if (ch === "/" && next === "/") {
      while (i < input.length && input[i] !== "\n") i += 1;
      out += "\n";
      continue;
    }

    out += ch;
  }

  return out;
}

export function parseWranglerConfig(raw) {
  const sanitized = stripJsoncLineComments(raw).replace(/,\s*([}\]])/g, "$1");
  return JSON.parse(sanitized);
}

export async function readWranglerConfig(cwd = process.cwd()) {
  const wranglerPath = resolve(cwd, "wrangler.jsonc");
  const raw = await readFile(wranglerPath, "utf8");
  return {
    raw,
    wranglerPath,
    config: parseWranglerConfig(raw),
  };
}

export function getPrimaryD1DatabaseName(config) {
  return config?.d1_databases?.[0]?.database_name ?? null;
}

export function getPrimaryD1DatabaseId(config) {
  return config?.d1_databases?.[0]?.database_id ?? null;
}

export function resolveWranglerBinary(cwd = process.cwd()) {
  const localBinary = resolve(cwd, "node_modules/.bin/wrangler");
  if (existsSync(localBinary)) {
    return localBinary;
  }
  return "wrangler";
}

export function execWrangler(args, options = {}) {
  const { cwd = process.cwd(), ...spawnOptions } = options;
  return spawnSync(resolveWranglerBinary(cwd), args, {
    cwd,
    encoding: "utf8",
    ...spawnOptions,
  });
}
