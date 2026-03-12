#!/usr/bin/env node

import { buildGeneratedAppTemplateSnapshotReport } from "../lib/template-snapshot.mjs";
import {
  takeTemplateSnapshotCliArgs,
} from "./template-cli-options.mjs";
import { runTemplateReportCli } from "./template-report-cli.mjs";

await runTemplateReportCli({
  action: "template-snapshot",
  parseArgs: takeTemplateSnapshotCliArgs,
  execute({ sourceDir, appName, coreOnly, include, exclude }) {
    return buildGeneratedAppTemplateSnapshotReport({
      sourceDir,
      appName,
      coreOnly,
      include,
      exclude,
    });
  },
});
