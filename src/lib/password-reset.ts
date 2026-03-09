import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { passwordResetTokens } from "../db/schema";

export const PASSWORD_RESET_TTL_HOURS = 2;

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hashOpaqueToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token)
  );
  return bytesToHex(new Uint8Array(digest));
}

export function resolvePasswordResetStatus(
  token: { usedAt: string | null; expiresAt: string },
  nowIso = new Date().toISOString()
): "pending" | "used" | "expired" {
  if (token.usedAt) return "used";
  if (token.expiresAt < nowIso) return "expired";
  return "pending";
}

export async function createPasswordResetToken(
  db: ReturnType<typeof drizzle>,
  userId: number
) {
  await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, userId));

  const token = crypto.randomUUID();
  const tokenHash = await hashOpaqueToken(token);
  const expiresAt = new Date(
    Date.now() + PASSWORD_RESET_TTL_HOURS * 60 * 60 * 1000
  ).toISOString();

  const [row] = await db
    .insert(passwordResetTokens)
    .values({
      userId,
      tokenHash,
      expiresAt,
    })
    .returning();

  return {
    id: row.id,
    token,
    expiresAt: row.expiresAt,
  };
}

export async function consumePasswordResetToken(
  db: ReturnType<typeof drizzle>,
  token: string
): Promise<
  | { ok: true; userId: number; tokenId: number }
  | { ok: false; reason: "not_found" | "expired" | "used" }
> {
  const tokenHash = await hashOpaqueToken(token);
  const [row] = await db
    .select({
      id: passwordResetTokens.id,
      userId: passwordResetTokens.userId,
      usedAt: passwordResetTokens.usedAt,
      expiresAt: passwordResetTokens.expiresAt,
    })
    .from(passwordResetTokens)
    .where(eq(passwordResetTokens.tokenHash, tokenHash))
    .limit(1);

  if (!row) {
    return { ok: false, reason: "not_found" };
  }

  const status = resolvePasswordResetStatus({
    usedAt: row.usedAt,
    expiresAt: row.expiresAt,
  });

  if (status === "expired") return { ok: false, reason: "expired" };
  if (status === "used") return { ok: false, reason: "used" };

  await db
    .update(passwordResetTokens)
    .set({ usedAt: new Date().toISOString() })
    .where(
      and(
        eq(passwordResetTokens.id, row.id),
        eq(passwordResetTokens.tokenHash, tokenHash)
      )
    );

  return { ok: true, userId: row.userId, tokenId: row.id };
}
