import { describe, expect, it } from "vitest";
import {
  hashPassword,
  needsPasswordUpgrade,
  verifyPassword,
} from "../src/lib/password";

describe("password helpers", () => {
  it("hashes and verifies PBKDF2 passwords", async () => {
    const hashed = await hashPassword("supersecure");

    expect(hashed.startsWith("pbkdf2$")).toBe(true);
    expect(await verifyPassword("supersecure", hashed)).toBe(true);
    expect(await verifyPassword("wrong", hashed)).toBe(false);
  });

  it("detects legacy password format", async () => {
    expect(needsPasswordUpgrade("salt:hash")).toBe(true);
    expect(needsPasswordUpgrade("pbkdf2$310000$salt$hash")).toBe(false);
  });
});
