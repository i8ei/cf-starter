import { runModulesPlanCli } from "../internal/modules-plan.mjs";
import { printDeprecatedCommandNotice } from "../lib/deprecation.mjs";

printDeprecatedCommandNotice("npm run modules:plan", "create-cf-starter <target>");
runModulesPlanCli();
