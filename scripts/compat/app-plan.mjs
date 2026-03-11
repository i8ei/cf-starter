import { runAppPlanCli } from "../internal/app-plan.mjs";
import { printDeprecatedCommandNotice } from "../lib/deprecation.mjs";

printDeprecatedCommandNotice("npm run app:plan", "create-cf-starter <target> [--starter|--include|--exclude]");
runAppPlanCli();
