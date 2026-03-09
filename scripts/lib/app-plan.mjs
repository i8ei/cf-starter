import { starterManifest } from "./starter-manifest.mjs";

export function buildAppPlan({ coreOnly = false } = {}) {
  return {
    mode: coreOnly ? "core-only" : "starter",
    core: starterManifest.core,
    exampleFeatures: starterManifest.exampleFeatures,
    optionalBindings: starterManifest.optionalBindings,
    nextSteps: coreOnly
      ? [
          "Remove example feature routes from src/index.ts",
          "Remove example feature hooks and shared schemas",
          "Keep /api/auth, /api/orgs, /api/health, /api/modules as the starter baseline",
        ]
      : [
          "Decide which example features stay in the new app",
          "Replace remaining example routes with domain routes",
          "Keep organization-aware patterns for new business tables",
        ],
  };
}

export function formatAppPlanText(plan) {
  const lines = [
    "Starter app plan",
    "",
    "Keep as core",
    `- ${plan.core.summary}`,
    ...plan.core.backendPaths.map((path) => `- backend: ${path}`),
    ...plan.core.frontendPaths.map((path) => `- frontend: ${path}`),
    ...plan.core.sharedPaths.map((path) => `- shared: ${path}`),
    "",
    plan.mode === "core-only"
      ? "Remove or replace these example features"
      : "Review these example features",
  ];

  for (const feature of plan.exampleFeatures) {
    lines.push(`- ${feature.key}: ${feature.summary}`);
    lines.push(`  routes: ${feature.routes.join(", ")}`);
    lines.push(`  bindings: ${feature.requiredBindings.join(", ")}`);
  }

  lines.push("");
  lines.push("Optional bindings");
  for (const binding of plan.optionalBindings) {
    lines.push(`- ${binding.key}: ${binding.usedBy.join(", ")}`);
  }

  lines.push("");
  lines.push("Next steps");
  for (const step of plan.nextSteps) {
    lines.push(`- ${step}`);
  }

  return lines.join("\n");
}
