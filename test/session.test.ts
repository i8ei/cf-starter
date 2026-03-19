import { describe, expect, it } from "vitest";
import {
  HOST_SESSION_COOKIE_NAME,
  resolveCookieOptions,
  resolveSessionCookieName,
} from "../src/lib/session";
import { createTestEnv } from "./helpers";

describe("session helpers", () => {
  it("uses a __Host- cookie name and enforces secure cookies for SameSite=None", () => {
    expect(HOST_SESSION_COOKIE_NAME).toBe("__Host-session");
    expect(resolveSessionCookieName(createTestEnv())).toBe("__Host-session");
    expect(
      resolveCookieOptions(
        createTestEnv({
          COOKIE_SAME_SITE: "None",
          COOKIE_SECURE: "false",
        })
      )
    ).toEqual({
      sameSite: "None",
      secure: true,
    });
  });
});
