import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { setCookie, deleteCookie } from "hono/cookie";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { users, sessions } from "../db/schema";
import { loginSchema, signupSchema } from "../../shared/schemas/auth";
import { requireAuth } from "../middleware/auth";
import type { Env } from "../types";

const SEVEN_DAYS = 60 * 60 * 24 * 7;
const PBKDF2_ITERATIONS = 310000;
const PBKDF2_KEY_LENGTH = 32;
const PBKDF2_ALGORITHM = "PBKDF2";
const PBKDF2_HASH = "SHA-256";

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error("invalid hex");
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = Number.parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function derivePbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    PBKDF2_ALGORITHM,
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: PBKDF2_ALGORITHM,
      hash: PBKDF2_HASH,
      salt,
      iterations,
    },
    keyMaterial,
    PBKDF2_KEY_LENGTH * 8
  );
  return bytesToHex(new Uint8Array(bits));
}

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hashHex = await derivePbkdf2(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${bytesToHex(salt)}$${hashHex}`;
}

async function verifyPassword(
  password: string,
  stored: string
): Promise<boolean> {
  // Backward compatibility with old "salt:sha256" format
  if (stored.includes(":")) {
    const [salt, hash] = stored.split(":");
    const data = new TextEncoder().encode(salt + password);
    const computed = await crypto.subtle.digest("SHA-256", data);
    const computedHex = bytesToHex(new Uint8Array(computed));
    return constantTimeEquals(hash, computedHex);
  }

  const [scheme, iterationRaw, saltHex, hashHex] = stored.split("$");
  if (scheme !== "pbkdf2" || !iterationRaw || !saltHex || !hashHex) {
    return false;
  }

  const iterations = Number.parseInt(iterationRaw, 10);
  if (!Number.isFinite(iterations) || iterations < 100000) return false;

  const salt = hexToBytes(saltHex);
  const computedHex = await derivePbkdf2(password, salt, iterations);
  return constantTimeEquals(hashHex, computedHex);
}

function setSessionCookie(c: any, sessionId: string) {
  setCookie(c, "session", sessionId, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/",
    maxAge: SEVEN_DAYS,
  });
}

const app = new Hono<{ Bindings: Env }>()
  .post("/signup", zValidator("json", signupSchema), async (c) => {
    const db = drizzle(c.env.DB);
    const { email, password, name } = c.req.valid("json");

    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existing) {
      return c.json({ error: "email already registered" }, 409);
    }

    const passwordHash = await hashPassword(password);
    const [user] = await db
      .insert(users)
      .values({ email, passwordHash, name })
      .returning();

    const sessionId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + SEVEN_DAYS * 1000).toISOString();
    await db.insert(sessions).values({ id: sessionId, userId: user.id, expiresAt });

    setSessionCookie(c, sessionId);
    return c.json({ id: user.id, email: user.email, name: user.name }, 201);
  })
  .post("/login", zValidator("json", loginSchema), async (c) => {
    const db = drizzle(c.env.DB);
    const { email, password } = c.req.valid("json");

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return c.json({ error: "invalid email or password" }, 401);
    }

    if (user.passwordHash.includes(":")) {
      const upgradedHash = await hashPassword(password);
      await db
        .update(users)
        .set({ passwordHash: upgradedHash })
        .where(eq(users.id, user.id));
    }

    const sessionId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + SEVEN_DAYS * 1000).toISOString();
    await db.insert(sessions).values({ id: sessionId, userId: user.id, expiresAt });

    setSessionCookie(c, sessionId);
    return c.json({ id: user.id, email: user.email, name: user.name });
  })
  .post("/logout", requireAuth, async (c) => {
    const db = drizzle(c.env.DB);
    const userId = c.get("userId");

    await db.delete(sessions).where(eq(sessions.userId, userId));
    deleteCookie(c, "session", { path: "/" });
    return c.json({ ok: true });
  })
  .get("/me", requireAuth, async (c) => {
    const db = drizzle(c.env.DB);
    const userId = c.get("userId");

    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return c.json({ error: "user not found" }, 404);
    }

    return c.json(user);
  });

export default app;
