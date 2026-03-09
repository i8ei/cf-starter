import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function stripLineComments(input) {
  let out = "";
  let inString = false;
  let escaped = false;

  for (let i = 0; i < input.length; i++) {
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
      while (i < input.length && input[i] !== "\n") i++;
      out += "\n";
      continue;
    }

    out += ch;
  }

  return out;
}

export function readWranglerConfig(cwd = process.cwd()) {
  const wranglerPath = resolve(cwd, "wrangler.jsonc");
  const raw = readFileSync(wranglerPath, "utf8");
  return JSON.parse(stripLineComments(raw).replace(/,\s*([}\]])/g, "$1"));
}

function hasBinding(config, key) {
  const kv = config.kv_namespaces?.some((item) => item.binding === key);
  const r2 = config.r2_buckets?.some((item) => item.binding === key);
  const queue = config.queues?.producers?.some((item) => item.binding === key);
  const durableObject = config.durable_objects?.bindings?.some(
    (item) => item.name === key
  );
  return kv || r2 || queue || durableObject;
}

function getVar(config, key) {
  return config.vars?.[key];
}

export function buildModulesPlan(config, env = process.env) {
  const emailProvider = (getVar(config, "EMAIL_PROVIDER") ?? "log").toLowerCase();

  return {
    modules: [
      {
        key: "jobs",
        kind: "core",
        enabled: hasBinding(config, "JOBS"),
        note: "core auth mail jobs and uploads",
      },
      {
        key: "rate_limiter",
        kind: "core",
        enabled: hasBinding(config, "RATE_LIMITER"),
        note: "auth rate limit",
      },
      {
        key: "kv",
        kind: "optional",
        enabled: hasBinding(config, "KV"),
        note: "example key-value feature",
      },
      {
        key: "upload",
        kind: "optional",
        enabled: hasBinding(config, "BUCKET"),
        note: "example upload feature",
      },
      {
        key: "email_delivery",
        kind: "optional",
        enabled:
          emailProvider === "resend" &&
          !!getVar(config, "EMAIL_FROM") &&
          !!env.RESEND_API_KEY,
        note:
          emailProvider === "resend"
            ? "set RESEND_API_KEY in env before deploy"
            : "log fallback active",
      },
    ],
  };
}

export function formatModulesPlanText(plan) {
  return [
    "Module plan",
    ...plan.modules.map(
      (module) =>
        `- [${module.enabled ? "x" : " "}] ${module.key} (${module.kind}) ${module.note}`
    ),
  ].join("\n");
}
