function isMissingValue(value) {
  return value === undefined || value === null || value === "" || value === "TODO";
}

function pushResource(changes, resourceType, binding, name, extra = {}) {
  changes.push({
    kind: "resource",
    resourceType,
    binding,
    name,
    ...extra,
  });
}

function pushBinding(changes, resourceType, binding, field, value) {
  changes.push({
    kind: "binding",
    resourceType,
    binding,
    field,
    status: isMissingValue(value) ? "missing" : "configured",
    value: isMissingValue(value) ? null : value,
  });
}

export function buildEnvPlan({ config = {} }) {
  const changes = [];
  const warnings = [];

  for (const db of config.d1_databases ?? []) {
    pushResource(changes, "d1", db.binding ?? "DB", db.database_name ?? null, {
      status: isMissingValue(db.database_name) ? "missing" : "configured",
    });
    pushBinding(changes, "d1", db.binding ?? "DB", "database_name", db.database_name);
    pushBinding(changes, "d1", db.binding ?? "DB", "database_id", db.database_id);
  }

  for (const kv of config.kv_namespaces ?? []) {
    pushResource(changes, "kv", kv.binding ?? "KV", kv.id ?? null, {
      status: isMissingValue(kv.id) ? "missing" : "configured",
    });
    pushBinding(changes, "kv", kv.binding ?? "KV", "id", kv.id);
  }

  for (const bucket of config.r2_buckets ?? []) {
    pushResource(changes, "r2", bucket.binding ?? "BUCKET", bucket.bucket_name ?? null, {
      status: isMissingValue(bucket.bucket_name) ? "missing" : "configured",
    });
    pushBinding(changes, "r2", bucket.binding ?? "BUCKET", "bucket_name", bucket.bucket_name);
  }

  for (const producer of config.queues?.producers ?? []) {
    pushResource(changes, "queue", producer.binding ?? "JOBS", producer.queue ?? null, {
      status: isMissingValue(producer.queue) ? "missing" : "configured",
    });
    pushBinding(changes, "queue", producer.binding ?? "JOBS", "queue", producer.queue);
  }

  for (const binding of config.durable_objects?.bindings ?? []) {
    pushResource(changes, "durable_object", binding.name ?? "DO", binding.class_name ?? null, {
      status: isMissingValue(binding.class_name) ? "missing" : "configured",
    });
    pushBinding(changes, "durable_object", binding.name ?? "DO", "class_name", binding.class_name);
  }

  const missingBindings = changes.filter((change) => change.kind === "binding" && change.status === "missing");
  if (missingBindings.length > 0) {
    warnings.push(`${missingBindings.length} binding value(s) still need to be filled in.`);
  }

  const resourceCount = changes.filter((change) => change.kind === "resource").length;
  const configuredCount = changes.filter((change) => change.kind === "binding" && change.status === "configured").length;

  return {
    ok: true,
    command: "env plan",
    mode: "plan",
    target: "config",
    summary: [
      `${resourceCount} Cloudflare resource definition(s) were found in wrangler.jsonc.`,
      `${configuredCount} binding value(s) are already configured.`,
    ],
    checks: [],
    changes,
    warnings,
    nextSteps: missingBindings.length > 0
      ? [
          "Create any missing Cloudflare resources.",
          "Write returned ids or names into wrangler.jsonc before remote operations.",
        ]
      : ["Resource definitions look complete from wrangler.jsonc alone."],
  };
}
