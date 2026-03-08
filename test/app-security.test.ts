import { describe, expect, it } from "vitest";
import { app } from "../src/index";
import { HOST_SESSION_COOKIE_NAME } from "../src/lib/session";
import { createTestEnv } from "./helpers";

describe("app security", () => {
  it("allows configured CORS origin on preflight", async () => {
    const res = await app.fetch(
      new Request("http://local.test/api/auth/login", {
        method: "OPTIONS",
        headers: {
          origin: "http://localhost:5173",
          "access-control-request-method": "POST",
        },
      }),
      createTestEnv()
    );

    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
      "http://localhost:5173"
    );
    expect(res.headers.get("Access-Control-Allow-Credentials")).toBe("true");
  });

  it("rejects cross-site mutating requests with a session cookie", async () => {
    const res = await app.fetch(
      new Request("http://local.test/api/auth/logout", {
        method: "POST",
        headers: {
          cookie: `${HOST_SESSION_COOKIE_NAME}=abc`,
          origin: "https://evil.example",
        },
      }),
      createTestEnv()
    );

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "forbidden (csrf)" });
  });

  it("blocks requests after the auth login rate limit is exhausted", async () => {
    const env = createTestEnv();
    const request = () =>
      app.fetch(
        new Request("http://local.test/api/auth/login", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "cf-connecting-ip": "203.0.113.10",
          },
          body: JSON.stringify({}),
        }),
        env
      );

    for (let i = 0; i < 10; i++) {
      const res = await request();
      expect(res.status).toBe(400);
    }

    const blocked = await request();
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("Retry-After")).toBeTruthy();
  });
});
