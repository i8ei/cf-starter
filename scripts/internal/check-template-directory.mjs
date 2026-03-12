#!/usr/bin/env node

import { assertTemplateDirectoryMatches } from "../lib/template-directory.mjs";
import {
  takeTemplateCheckCliArgs,
} from "./template-cli-options.mjs";
import { runTemplateReportCli } from "./template-report-cli.mjs";

await runTemplateReportCli({
  action: "template-check",
  parseArgs: takeTemplateCheckCliArgs,
  execute({ sourceDir, templateDir, appName }) {
    return assertTemplateDirectoryMatches({
      sourceDir,
      templateDir,
      appName,
    });
  },
});
