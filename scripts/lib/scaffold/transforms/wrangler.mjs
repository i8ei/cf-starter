import { parseWranglerConfig } from "../../wrangler-config.mjs";
import { removeJsoncPropertyBlock, replaceJsoncStringProperty } from "./jsonc.mjs";

export function rewriteWranglerJsonc(source, appName, requiredBindings) {
  const config = parseWranglerConfig(source);
  let updated = source;

  updated = replaceJsoncStringProperty(updated, "name", config?.name, appName);

  const primaryDatabaseName = config?.d1_databases?.[0]?.database_name;
  updated = replaceJsoncStringProperty(
    updated,
    "database_name",
    primaryDatabaseName,
    `${appName}-db`
  );

  const primaryBucketName = config?.r2_buckets?.[0]?.bucket_name;
  updated = replaceJsoncStringProperty(
    updated,
    "bucket_name",
    primaryBucketName,
    `${appName}-bucket`
  );

  const producerQueue = config?.queues?.producers?.[0]?.queue;
  if (typeof producerQueue === "string") {
    updated = replaceJsoncStringProperty(
      updated,
      "queue",
      producerQueue,
      `${appName}-jobs`,
      { global: true }
    );
  }

  const emailFrom = config?.vars?.EMAIL_FROM;
  updated = replaceJsoncStringProperty(
    updated,
    "EMAIL_FROM",
    emailFrom,
    `${appName} <noreply@example.com>`
  );

  if (!requiredBindings.includes("KV")) {
    updated = removeJsoncPropertyBlock(updated, "kv_namespaces");
  }
  if (!requiredBindings.includes("BUCKET")) {
    updated = removeJsoncPropertyBlock(updated, "r2_buckets");
  }

  return updated.replace(/\n{3,}/g, "\n\n");
}
