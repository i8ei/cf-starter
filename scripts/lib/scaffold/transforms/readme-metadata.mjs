import { renderGeneratedAppReadme } from "../renderers/readme.mjs";

export function rewriteGeneratedAppReadme({
  appName,
  coreOnly = false,
  selectedFeatures = [],
  requiredBindings,
}) {
  return renderGeneratedAppReadme({
    appName,
    coreOnly,
    selectedFeatures,
    requiredBindings,
  });
}
