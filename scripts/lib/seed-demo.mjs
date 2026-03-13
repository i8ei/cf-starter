export function buildSeedDemoPlan({
  mode,
  email,
  name,
  organizationName,
  organizationSlug,
  config = {},
  includeCredentials = false,
  password = "",
}) {
  const target = mode === "--remote" ? "remote" : "local";
  const warnings = [];

  if (target === "remote" && (!config?.d1_databases?.[0]?.database_id || config.d1_databases[0].database_id === "TODO")) {
    warnings.push("Remote seed may fail because d1_databases[0].database_id is not set.");
  }

  const report = {
    ok: true,
    command: "db seed-demo",
    mode: "plan",
    target,
    summary: [
      `Demo seed will upsert 1 user and 1 organization in ${target} D1.`,
    ],
    checks: [],
    changes: [
      {
        kind: "row",
        table: "users",
        action: "upsert",
        identity: email,
      },
      {
        kind: "row",
        table: "organizations",
        action: "upsert",
        identity: organizationSlug,
      },
      {
        kind: "row",
        table: "memberships",
        action: "ensure",
        identity: `${email}:${organizationSlug}:owner`,
      },
    ],
    warnings,
    nextSteps: [
      `Run without --plan to apply the demo seed to ${target} D1.`,
    ],
    artifacts: {
      user: {
        email,
        name,
      },
      organization: {
        name: organizationName,
        slug: organizationSlug,
      },
    },
  };

  if (includeCredentials) {
    report.artifacts.credentials = {
      email,
      password,
    };
  }

  return report;
}
