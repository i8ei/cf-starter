export function formatCliUsage() {
  return [
    "Usage:",
    "  node scripts/cf-starter.mjs doctor [--json] [--remote]",
    "  node scripts/cf-starter.mjs env plan [--json]",
    "  node scripts/cf-starter.mjs db migrate [--plan] [--json] [--remote]",
    "  node scripts/cf-starter.mjs db seed-demo [--plan] [--json]",
    "  node scripts/cf-starter.mjs record generate --record <path> [--plan] [--json]",
    "  node scripts/cf-starter.mjs deploy [--plan] [--json]",
  ].join("\n");
}

export function resolveCliCommand(argv) {
  if (argv.length === 0 || argv[0] === "help" || argv[0] === "--help" || argv[0] === "-h") {
    return {
      ok: false,
      code: "usage",
      exitCode: 0,
      message: formatCliUsage(),
    };
  }

  if (argv[0] === "doctor") {
    return {
      ok: true,
      command: "doctor",
      script: "doctor.mjs",
      args: argv.slice(1),
    };
  }

  if (argv[0] === "db" && argv[1] === "migrate") {
    return {
      ok: true,
      command: "db migrate",
      script: "d1-migrate.mjs",
      args: argv.slice(2),
    };
  }

  if (argv[0] === "env" && argv[1] === "plan") {
    return {
      ok: true,
      command: "env plan",
      script: "env-plan.mjs",
      args: argv.slice(2),
    };
  }

  if (argv[0] === "db" && argv[1] === "seed-demo") {
    return {
      ok: true,
      command: "db seed-demo",
      script: "seed-demo.mjs",
      args: argv.slice(2),
    };
  }

  if (argv[0] === "record" && argv[1] === "generate") {
    return {
      ok: true,
      command: "record generate",
      script: "generate-record.mjs",
      args: argv.slice(2),
    };
  }

  if (argv[0] === "deploy") {
    return {
      ok: true,
      command: "deploy",
      script: "deploy.mjs",
      args: argv.slice(1),
    };
  }

  return {
    ok: false,
    code: "unknown_command",
    exitCode: 1,
    message: `Unknown command: ${argv.join(" ")}\n\n${formatCliUsage()}`,
  };
}
