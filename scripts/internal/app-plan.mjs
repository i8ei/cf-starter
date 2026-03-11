import { buildAppPlan, formatAppPlanText } from "../lib/app-plan.mjs";

export function runAppPlanCli(argv = process.argv.slice(2)) {
  const coreOnly = argv.includes("--core-only");
  const asJson = argv.includes("--json");
  const plan = buildAppPlan({ coreOnly });

  if (asJson) {
    console.log(JSON.stringify(plan, null, 2));
  } else {
    console.log(formatAppPlanText(plan));
  }
}

