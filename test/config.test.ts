import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { getAppConfig } from "../src/lib/config";
import { createTestEnv } from "./helpers";

describe("config", () => {
  it("parses and normalizes runtime env settings", () => {
    const config = getAppConfig(
      createTestEnv({
        CORS_ORIGIN: "https://app.example.com, http://localhost:5173",
        COOKIE_SAME_SITE: "strict",
        COOKIE_SECURE: "false",
      })
    );

    expect(config).toEqual({
      corsOrigins: ["https://app.example.com", "http://localhost:5173"],
      cookieSameSite: "Strict",
      cookieSecure: false,
    });
  });

  it("rejects invalid origin strings early", () => {
    expect(() =>
      getAppConfig(
        createTestEnv({
          CORS_ORIGIN: "https://app.example.com/path",
        })
      )
    ).toThrow(ZodError);
  });
});
