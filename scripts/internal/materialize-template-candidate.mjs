#!/usr/bin/env node

import { materializeTemplateCandidate } from "../lib/template-candidate.mjs";
import {
  takeTemplateMaterializeCliArgs,
} from "./template-cli-options.mjs";
import { runTemplateReportCli } from "./template-report-cli.mjs";

await runTemplateReportCli({
  action: "template-materialize",
  parseArgs: takeTemplateMaterializeCliArgs,
  execute({ sourceDir, targetDir, appName, coreOnly, include, exclude }) {
    return materializeTemplateCandidate({
      sourceDir,
      targetDir,
      appName,
      coreOnly,
      include,
      exclude,
    });
  },
});
