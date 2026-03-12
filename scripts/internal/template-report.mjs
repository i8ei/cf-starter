function buildTemplateMaterializeSummary(result) {
  return {
    templateRootPathCount: result.templateRootCopyPaths.length,
    optionalPathCount: result.selectedOptionalPaths.length,
    runtimeScriptCount: result.generatedAppRuntimeScriptPaths.length,
    copiedPathCount: result.copiedPaths.length,
  };
}

function buildTemplateMaterializeExtra(result) {
  return {
    relativeTargetDir: result.relativeTargetDir,
  };
}

function buildTemplateSnapshotSummary(result) {
  return {
    templateRootPathCount: result.expectedTemplateRootPaths.length,
    optionalPathCount: result.selectedOptionalPaths.length,
    runtimeScriptCount: result.generatedAppRuntimeScriptPaths.length,
    removedPathCount: result.filesRemoved.length,
    rewrittenPathCount: result.filesRewritten.length,
  };
}

function buildTemplateSnapshotExtra(result) {
  return {
    requiredBindings: result.requiredBindings,
  };
}

function buildTemplateCheckSummary(result) {
  return {
    expectedFileCount: result.expectedFiles.length,
    actualFileCount: result.actualFiles.length,
    missingCount: result.missingFiles.length,
    unexpectedCount: result.unexpectedFiles.length,
    changedCount: result.changedFiles.length,
  };
}

function buildTemplateCheckExtra(result) {
  return {
    relativeTemplateDir: result.relativeTemplateDir,
    matches: result.matches,
  };
}

const TEMPLATE_REPORT_SUMMARY_BUILDERS = Object.freeze({
  "template-materialize": buildTemplateMaterializeSummary,
  "template-sync": buildTemplateMaterializeSummary,
  "template-snapshot": buildTemplateSnapshotSummary,
  "template-check": buildTemplateCheckSummary,
});

const TEMPLATE_REPORT_EXTRA_BUILDERS = Object.freeze({
  "template-materialize": buildTemplateMaterializeExtra,
  "template-sync": buildTemplateMaterializeExtra,
  "template-snapshot": buildTemplateSnapshotExtra,
  "template-check": buildTemplateCheckExtra,
});

export function buildTemplateReportSummary(action, result) {
  const buildSummary = TEMPLATE_REPORT_SUMMARY_BUILDERS[action];
  if (!buildSummary) {
    throw new Error(`Unknown template report action: ${action}`);
  }
  return buildSummary(result);
}

export function buildTemplateReportExtra(action, result) {
  const buildExtra = TEMPLATE_REPORT_EXTRA_BUILDERS[action];
  if (!buildExtra) {
    throw new Error(`Unknown template report action: ${action}`);
  }
  return buildExtra(result);
}

export function buildTemplateReport({
  action,
  result,
  summary = buildTemplateReportSummary(action, result),
  verbose = false,
  details = result,
  extra = buildTemplateReportExtra(action, result),
} = {}) {
  return {
    action,
    sourceKind: result.sourceKind,
    profile: result.profile,
    selectedFeatures: result.selectedFeatures,
    ...extra,
    summary,
    ...(verbose ? { details } : {}),
  };
}

export function serializeTemplateReport(report, { compact = false } = {}) {
  return `${JSON.stringify(report, null, compact ? 0 : 2)}\n`;
}
