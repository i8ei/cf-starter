/**
 * Secret configuration checks for scripts/security-check.mjs.
 *
 * Secrets must live in Cloudflare secrets (`wrangler secret put`) plus
 * .dev.vars for local development — never in wrangler.jsonc vars, which
 * are committed to git and shown as plaintext in the dashboard.
 */

/**
 * @param {object} input
 * @param {Record<string, string>} input.vars - wrangler.jsonc vars
 * @param {string[]} input.requiredSecrets - secret names required by the auth mode
 * @param {string[] | null} input.secretList - names from `wrangler secret list`,
 *   or null when the list could not be fetched (offline / not logged in)
 * @returns {{ id: string, level: "pass" | "warn" | "block", message: string }[]}
 */
export function evaluateSecretChecks({ vars = {}, requiredSecrets = [], secretList = null }) {
  const checks = [];

  for (const name of requiredSecrets) {
    const id = name.toLowerCase().replaceAll("_", "-");

    if (typeof vars[name] === "string" && vars[name].length > 0) {
      checks.push({
        id,
        level: "block",
        message: `${name} is set in wrangler.jsonc vars — that commits it to git as plaintext. Remove it and run \`npx wrangler secret put ${name}\` (use .dev.vars for local dev).`,
      });
      continue;
    }

    if (secretList === null) {
      checks.push({
        id,
        level: "warn",
        message: `${name} could not be verified (\`wrangler secret list\` failed — not logged in?). Verify with \`npx wrangler secret list\` or \`npm run setup:remote\`.`,
      });
      continue;
    }

    if (secretList.includes(name)) {
      checks.push({
        id,
        level: "pass",
        message: `${name} is set as a Cloudflare secret`,
      });
    } else {
      checks.push({
        id,
        level: "block",
        message: `${name} is not set. Run \`npx wrangler secret put ${name}\`.`,
      });
    }
  }

  return checks;
}
