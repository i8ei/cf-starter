import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { printDeprecatedCommandNotice } from "../lib/deprecation.mjs";
import { runScaffoldAppCli } from "../internal/scaffold-app.mjs";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_SOURCE_DIR = resolve(SCRIPT_DIR, "../..");
const usage = "Usage: node scripts/compat/scaffold-app.mjs --target <dir> [--core-only] [--force] [--plan] [--json]";

await runScaffoldAppCli({
  sourceDir: DEFAULT_SOURCE_DIR,
  usage,
  deprecationNotice: () =>
    printDeprecatedCommandNotice(
      "npm run app:scaffold",
      "create-cf-starter <target> [--starter|--include|--exclude]"
    ),
});
