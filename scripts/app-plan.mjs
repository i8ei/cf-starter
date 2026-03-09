import { buildAppPlan, formatAppPlanText } from "./lib/app-plan.mjs";
const coreOnly = process.argv.includes("--core-only");
const asJson = process.argv.includes("--json");
const plan = buildAppPlan({ coreOnly });

if (asJson) {
  console.log(JSON.stringify(plan, null, 2));
} else {
  console.log(formatAppPlanText(plan));
}
