import { describe, expect, it } from "vitest";
import { resolveCliCommand } from "../scripts/lib/cli-router.mjs";

describe("resolveCliCommand", () => {
  it("routes doctor", () => {
    expect(resolveCliCommand(["doctor", "--json"])).toEqual({
      ok: true,
      command: "doctor",
      script: "doctor.mjs",
      args: ["--json"],
    });
  });

  it("routes db migrate", () => {
    expect(resolveCliCommand(["db", "migrate", "--plan", "--json"])).toEqual({
      ok: true,
      command: "db migrate",
      script: "d1-migrate.mjs",
      args: ["--plan", "--json"],
    });
  });

  it("routes env plan", () => {
    expect(resolveCliCommand(["env", "plan", "--json"])).toEqual({
      ok: true,
      command: "env plan",
      script: "env-plan.mjs",
      args: ["--json"],
    });
  });

  it("routes db seed-demo", () => {
    expect(resolveCliCommand(["db", "seed-demo", "--plan"])).toEqual({
      ok: true,
      command: "db seed-demo",
      script: "seed-demo.mjs",
      args: ["--plan"],
    });
  });

  it("routes record generate", () => {
    expect(resolveCliCommand(["record", "generate", "--record", "shared/records/task.ts"])).toEqual({
      ok: true,
      command: "record generate",
      script: "generate-record.mjs",
      args: ["--record", "shared/records/task.ts"],
    });
  });

  it("routes deploy", () => {
    expect(resolveCliCommand(["deploy", "--plan", "--json"])).toEqual({
      ok: true,
      command: "deploy",
      script: "deploy.mjs",
      args: ["--plan", "--json"],
    });
  });

  it("returns usage for help", () => {
    const result = resolveCliCommand(["--help"]);
    expect(result.ok).toBe(false);
    expect(result.exitCode).toBe(0);
    expect(result.message).toContain("Usage:");
  });

  it("fails on unknown commands", () => {
    const result = resolveCliCommand(["unknown", "--plan"]);
    expect(result.ok).toBe(false);
    expect(result.exitCode).toBe(1);
    expect(result.message).toContain("Unknown command");
  });
});
