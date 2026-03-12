import { writeFile } from "node:fs/promises";
import { assertNoUnknownArgs } from "../lib/cli-args.mjs";
import { buildTemplateReport, serializeTemplateReport } from "./template-report.mjs";

export async function runTemplateReportCli({
  action,
  argv = process.argv.slice(2),
  parseArgs,
  execute,
} = {}) {
  const args = [...argv];
  const context = await parseArgs(args);

  assertNoUnknownArgs(args);

  if (context.prepare) {
    await context.prepare();
  }

  const result = await execute(context);
  const report = buildTemplateReport({
    action,
    result,
    verbose: context.verbose ?? false,
  });
  const serialized = serializeTemplateReport(report, {
    compact: context.compact ?? false,
  });

  if (context.outputPath) {
    await writeFile(context.outputPath, serialized);
  }

  process.stdout.write(serialized);
  return {
    context,
    result,
    report,
    serialized,
  };
}
