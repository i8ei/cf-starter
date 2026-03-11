import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { moduleCatalog } from "../../shared/module-catalog.mjs";

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
  const enabledByKey = {
    jobs: hasBinding(config, "JOBS"),
    rate_limiter: hasBinding(config, "RATE_LIMITER"),
    kv: hasBinding(config, "KV"),
    upload: hasBinding(config, "BUCKET"),
    email_delivery:
      emailProvider === "resend" &&
      !!getVar(config, "EMAIL_FROM") &&
      !!env.RESEND_API_KEY,
  };

  return {
    modules: moduleCatalog.map((module) => ({
      key: module.key,
      label: module.label,
      kind: module.kind,
      enabled: enabledByKey[module.key],
      note:
        module.key === "email_delivery" && emailProvider === "resend"
          ? "set RESEND_API_KEY in env before deploy"
          : module.note,
    })),
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
