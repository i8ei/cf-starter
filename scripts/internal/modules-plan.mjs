import {
  buildModulesPlan,
  formatModulesPlanText,
  readWranglerConfig,
} from "../lib/modules-plan.mjs";

export function runModulesPlanCli(argv = process.argv.slice(2)) {
  const asJson = argv.includes("--json");
  const config = readWranglerConfig();
  const plan = buildModulesPlan(config);

  if (asJson) {
    console.log(JSON.stringify(plan, null, 2));
  } else {
    console.log(formatModulesPlanText(plan));
  }
}

