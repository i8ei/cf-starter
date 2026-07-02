import { describe, expect, it } from "vitest";
import { evaluateSecretChecks } from "../scripts/lib/security-check.mjs";

type SecretCheck = { id: string; level: "pass" | "warn" | "block"; message: string };

describe("evaluateSecretChecks", () => {
  it("returns no checks when no secrets are required (AUTH_MODE=none)", () => {
    const checks: SecretCheck[] = evaluateSecretChecks({
      vars: {},
      requiredSecrets: [],
      secretList: null,
    });
    expect(checks).toEqual([]);
  });

  it("blocks when a secret is committed in wrangler.jsonc vars", () => {
    const checks: SecretCheck[] = evaluateSecretChecks({
      vars: { BETTER_AUTH_SECRET: "super-secret-value" },
      requiredSecrets: ["BETTER_AUTH_SECRET"],
      secretList: null,
    });
    expect(checks).toHaveLength(1);
    expect(checks[0]).toMatchObject({ id: "better-auth-secret", level: "block" });
    expect(checks[0].message).toContain("wrangler secret put");
  });

  it("passes when the secret exists in wrangler secret list", () => {
    const checks: SecretCheck[] = evaluateSecretChecks({
      vars: {},
      requiredSecrets: ["BETTER_AUTH_SECRET"],
      secretList: ["BETTER_AUTH_SECRET", "OTHER"],
    });
    expect(checks).toEqual([
      expect.objectContaining({ id: "better-auth-secret", level: "pass" }),
    ]);
  });

  it("blocks when the secret is missing from wrangler secret list", () => {
    const checks: SecretCheck[] = evaluateSecretChecks({
      vars: {},
      requiredSecrets: ["ADMIN_PASSWORD"],
      secretList: [],
    });
    expect(checks).toEqual([
      expect.objectContaining({ id: "admin-password", level: "block" }),
    ]);
  });

  it("warns instead of blocking when the secret list is unavailable", () => {
    const checks: SecretCheck[] = evaluateSecretChecks({
      vars: {},
      requiredSecrets: ["BETTER_AUTH_SECRET"],
      secretList: null,
    });
    expect(checks).toEqual([
      expect.objectContaining({ id: "better-auth-secret", level: "warn" }),
    ]);
  });
});
