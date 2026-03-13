export function buildMigrationPlan({
  dbName,
  mode,
  cwd,
  localMigrations = [],
  featureMigrations = [],
  copiedFeatureMigrations = [],
  config = {},
}) {
  const target = mode === "--remote" ? "remote" : "local";
  const allMigrations = [...localMigrations, ...featureMigrations];
  const summary = [];

  summary.push(`${allMigrations.length} migration file(s) are ready for ${target} apply.`);
  if (featureMigrations.length > 0) {
    summary.push(`${featureMigrations.length} feature migration(s) will be materialized into the temp workspace.`);
  }

  const changes = [
    ...localMigrations.map((name) => ({
      kind: "migration",
      source: "project",
      name,
      status: "pending",
    })),
    ...featureMigrations.map((name) => ({
      kind: "migration",
      source: "feature-pack",
      name,
      status: copiedFeatureMigrations.includes(name) ? "materialize" : "pending",
    })),
  ];

  const warnings = [];
  if (target === "remote" && (!config?.d1_databases?.[0]?.database_id || config.d1_databases[0].database_id === "TODO")) {
    warnings.push("Remote apply may fail because d1_databases[0].database_id is not set.");
  }

  return {
    ok: Boolean(dbName),
    command: "db migrate",
    mode: "plan",
    target,
    summary,
    checks: [],
    changes,
    warnings,
    nextSteps: [
      target === "remote"
        ? "Run the command without --plan after confirming remote D1 binding values."
        : "Run the command without --plan to apply migrations to local D1 state.",
    ],
    artifacts: {
      workspace: {
        cwd,
        tempWranglerConfig: "wrangler.jsonc",
        tempMigrationsDir: "migrations",
      },
    },
  };
}
