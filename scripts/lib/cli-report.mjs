export function printReport(report, { json = false } = {}) {
  if (json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  for (const line of report.summary ?? []) {
    console.log(line);
  }

  for (const check of report.checks ?? []) {
    const prefix =
      check.level === "pass" ? "PASS" : check.level === "warn" ? "WARN" : check.level === "info" ? "INFO" : "FAIL";
    console.log(`${prefix} ${check.message}`);
  }

  for (const warning of report.warnings ?? []) {
    console.log(`WARN ${warning}`);
  }

  for (const change of report.changes ?? []) {
    if (change.kind === "migration") {
      console.log(`PLAN ${change.name} (${change.source})`);
      continue;
    }
    if (change.kind === "step") {
      console.log(`PLAN ${change.label}`);
      continue;
    }
    if (change.kind === "row") {
      console.log(`PLAN ${change.action} ${change.table} ${change.identity}`);
      continue;
    }
    if (change.kind === "resource") {
      console.log(`PLAN ${change.resourceType} ${change.binding} ${change.name ?? "(missing)"}`);
      continue;
    }
    if (change.kind === "binding") {
      console.log(`PLAN ${change.resourceType}.${change.binding}.${change.field} ${change.status}`);
      continue;
    }
    if (change.path) {
      console.log(`PLAN ${change.action} ${change.path}`);
    }
  }

  if ((report.nextSteps ?? []).length > 0) {
    console.log("");
    console.log("Next steps:");
    for (const step of report.nextSteps) {
      console.log(`- ${step}`);
    }
  }
}
