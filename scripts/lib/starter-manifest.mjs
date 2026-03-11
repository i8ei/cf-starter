export const starterManifest = {
  core: {
    summary:
      "Authentication, organization context, security middleware, queues, logging, and operational scripts.",
    backendPaths: [
      "src/index.ts",
      "src/routes/auth/index.ts",
      "src/routes/orgs.ts",
      "src/routes/health.ts",
      "src/routes/modules.ts",
      "src/middleware/",
      "src/lib/",
      "src/db/",
      "src/queues/",
      "src/durable-objects/",
    ],
    frontendPaths: [
      "app/App.tsx",
      "app/hooks/useSession.ts",
      "app/hooks/useHealth.ts",
      "app/lib/",
    ],
    sharedPaths: [
      "shared/schemas/auth.ts",
      "shared/schemas/orgs.ts",
    ],
  },
  exampleFeatures: [
    {
      key: "items",
      summary: "Simple D1 CRUD example.",
      routes: ["/api/items"],
      backendPaths: ["src/features/example/items/"],
      frontendPaths: ["app/features/example/items/"],
      sharedPaths: ["shared/features/example/items/"],
      requiredBindings: ["DB"],
    },
    {
      key: "kv",
      summary: "KV read/write example behind admin role.",
      routes: ["/api/kv/:key"],
      backendPaths: ["src/features/example/kv/"],
      frontendPaths: [],
      sharedPaths: [],
      requiredBindings: ["KV", "DB"],
    },
    {
      key: "upload",
      summary: "R2 upload example with queue handoff.",
      routes: ["/api/upload"],
      backendPaths: ["src/features/example/upload/"],
      frontendPaths: [],
      sharedPaths: [],
      requiredBindings: ["BUCKET", "JOBS", "DB"],
    },
  ],
  optionalBindings: [
    {
      key: "KV",
      usedBy: ["kv", "health"],
    },
    {
      key: "BUCKET",
      usedBy: ["upload", "health"],
    },
    {
      key: "JOBS",
      usedBy: ["queue emails", "upload"],
    },
    {
      key: "RATE_LIMITER",
      usedBy: ["auth rate limit"],
    },
  ],
};
