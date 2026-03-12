import { STARTER_ONLY_SCRIPTS } from "../../starter-catalog.mjs";

export function rewriteGeneratedAppPackageJson(source, appName, displayName) {
  const parsed = JSON.parse(source);
  parsed.name = appName;
  parsed.private = true;
  parsed.description = `${displayName} application scaffolded from cf-starter.`;
  delete parsed.bin;
  delete parsed.files;
  delete parsed.publishConfig;
  delete parsed.homepage;
  delete parsed.repository;
  delete parsed.bugs;
  delete parsed.keywords;

  if (parsed.scripts) {
    parsed.scripts.doctor ??= "node scripts/doctor.mjs";
    parsed.scripts["seed:demo"] ??= "node scripts/seed-demo.mjs";
    for (const key of STARTER_ONLY_SCRIPTS) {
      delete parsed.scripts[key];
    }
  }

  return `${JSON.stringify(parsed, null, 2)}\n`;
}
