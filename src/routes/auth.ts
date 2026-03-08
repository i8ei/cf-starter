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

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomUUID();
  const data = new TextEncoder().encode(salt + password);
  const hash = await crypto.subtle.digest("SHA-256", data);
  const hashHex = [...new Uint8Array(hash)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${salt}:${hashHex}`;
}

async function verifyPassword(
  password: string,
  stored: string
): Promise<boolean> {
  const [salt, hash] = stored.split(":");
  const data = new TextEncoder().encode(salt + password);
  const computed = await crypto.subtle.digest("SHA-256", data);
  const computedHex = [...new Uint8Array(computed)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hash === computedHex;
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
