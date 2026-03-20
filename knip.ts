import type { KnipConfig } from "knip";

const config: KnipConfig = {
  entry: [
    "test/**/*.test.ts",
    "scripts/*.mjs",
    "e2e/**/*.spec.ts",
  ],
  project: [
    "app/**",
    "src/**",
    "shared/**",
    "!**/features/**",
  ],
  ignore: [
    // Record Engine addon — used when records are generated
    "app/pages/records/**",
    "app/components/fields/**",
    "app/components/DataTable.tsx",
    "app/components/StatusBadge.tsx",
    "app/components/StatusFilterTabs.tsx",
    "app/components/SummaryCards.tsx",
    "shared/lib/record-def.ts",
    "shared/records/**",
    // Dashboard addon — used by apps that build dashboards
    "app/components/charts/**",
    "app/lib/format.ts",
    // Utilities available to apps
    "src/lib/d1-batch.ts",
    "src/middleware/require-role.ts",
  ],
  ignoreExportsUsedInFile: true,
  // Template API exports — used by generated/app code
  rules: {
    exports: "warn",
    types: "warn",
  },
};

export default config;
