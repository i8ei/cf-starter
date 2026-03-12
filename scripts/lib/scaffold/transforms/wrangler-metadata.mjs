import { rewriteWranglerJsonc } from "./wrangler.mjs";

export function rewriteGeneratedAppWrangler(source, appName, requiredBindings) {
  return rewriteWranglerJsonc(source, appName, requiredBindings);
}
