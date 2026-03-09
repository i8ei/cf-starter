import {
  buildModulesPlan,
  formatModulesPlanText,
  readWranglerConfig,
} from "./lib/modules-plan.mjs";

const asJson = process.argv.includes("--json");
const config = readWranglerConfig();
const plan = buildModulesPlan(config);

if (asJson) {
  console.log(JSON.stringify(plan, null, 2));
} else {
  console.log(formatModulesPlanText(plan));
}
