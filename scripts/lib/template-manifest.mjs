import { DOCTOR_REQUIRED_RUNTIME_PATHS } from "./starter-catalog.mjs";

export const TEMPLATE_ROOT_PATHS = Object.freeze([
  ".gitignore",
  ".github/workflows/ci.yml",
  "README.md",
  "app",
  "drizzle.config.ts",
  "examples",
  "index.html",
  "migrations",
  "package.json",
  "shared",
  "src",
  "test/app-security.test.ts",
  "test/audit.test.ts",
  "test/config.test.ts",
  "test/email-verification.test.ts",
  "test/email.test.ts",
  "test/example-organization-scope.test.ts",
  "test/helpers.ts",
  "test/jobs.test.ts",
  "test/logging.test.ts",
  "test/org-role.test.ts",
  "test/organizations.test.ts",
  "test/password-reset.test.ts",
  "test/password.test.ts",
  "test/rbac.test.ts",
  "test/record-engine.test.ts",
  "test/session-maintenance.test.ts",
  "test/session.test.ts",
  "tsconfig.json",
  "vite.config.split.ts",
  "vite.config.ts",
  "vitest.config.ts",
  "wrangler.jsonc",
]);

export const GENERATED_APP_RUNTIME_SCRIPT_PATHS = DOCTOR_REQUIRED_RUNTIME_PATHS;

export const SCAFFOLD_RUNTIME_SUPPORT_PATHS = Object.freeze([
  "bin/create-cf-starter",
  "scripts/create-cf-starter.mjs",
  "scripts/internal/scaffold-app.mjs",
  "scripts/lib/cli-args.mjs",
  "scripts/lib/scaffold.mjs",
  "scripts/lib/scaffold/orchestrator.mjs",
  "scripts/lib/scaffold/planner.mjs",
  "scripts/lib/scaffold/renderers/app-template.mjs",
  "scripts/lib/scaffold/renderers/readme.mjs",
  "scripts/lib/scaffold/renderers/workflow.mjs",
  "scripts/lib/scaffold/transforms/cleanup.mjs",
  "scripts/lib/scaffold/transforms/app-metadata.mjs",
  "scripts/lib/scaffold/transforms/file-ops.mjs",
  "scripts/lib/scaffold/transforms/feature-selection.mjs",
  "scripts/lib/scaffold/transforms/helpers.mjs",
  "scripts/lib/scaffold/transforms/index-selection.mjs",
  "scripts/lib/scaffold/transforms/items-selection.mjs",
  "scripts/lib/scaffold/transforms/jsonc.mjs",
  "scripts/lib/scaffold/transforms/metadata.mjs",
  "scripts/lib/scaffold/transforms/package-metadata.mjs",
  "scripts/lib/scaffold/transforms/readme-metadata.mjs",
  "scripts/lib/scaffold/transforms/scaffold-markers.mjs",
  "scripts/lib/scaffold/transforms/wrangler.mjs",
  "scripts/lib/scaffold/transforms/wrangler-metadata.mjs",
  "scripts/lib/starter-manifest.mjs",
  "scripts/lib/template-source.mjs",
]);

export const TEMPLATE_OPTIONAL_PATHS = Object.freeze({
  items: Object.freeze([
    "examples/feature-packs/items",
    "migrations/0010_example_items.sql",
  ]),
  kv: Object.freeze([
    "examples/feature-packs/kv",
    "examples/lib",
  ]),
  upload: Object.freeze([
    "examples/feature-packs/upload",
    "examples/lib",
  ]),
});

export function normalizeTemplateManifestPath(filePath) {
  return filePath.replace(/\/+$/, "");
}
