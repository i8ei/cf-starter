#!/usr/bin/env node

import { materializeTemplateDirectory } from "../lib/template-directory.mjs";
import {
  takeTemplateSyncCliArgs,
} from "./template-cli-options.mjs";
import { runTemplateReportCli } from "./template-report-cli.mjs";

await runTemplateReportCli({
  action: "template-sync",
  parseArgs: takeTemplateSyncCliArgs,
  execute({ sourceDir, targetDir, appName }) {
    return materializeTemplateDirectory({
      sourceDir,
      targetDir,
      appName,
    });
  },
});
