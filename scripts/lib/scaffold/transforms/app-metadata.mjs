export function rewriteGeneratedAppShell(source, appName, displayName) {
  return source.replaceAll("cf-starter", appName).replaceAll("Starter Core", displayName);
}
