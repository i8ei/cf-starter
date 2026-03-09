import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { emailVerificationTokens, users } from "../db/schema";
import { hashOpaqueToken } from "./password-reset";

export const EMAIL_VERIFICATION_TTL_HOURS = 24 * 7;

export function resolveEmailVerificationStatus(
  token: { verifiedAt: string | null; expiresAt: string },
  nowIso = new Date().toISOString()
): "pending" | "verified" | "expired" {
  if (token.verifiedAt) return "verified";
  if (token.expiresAt < nowIso) return "expired";
  return "pending";
}

export async function createEmailVerificationToken(
  db: ReturnType<typeof drizzle>,
  userId: number
) {
  await db
    .delete(emailVerificationTokens)
    .where(eq(emailVerificationTokens.userId, userId));

  const token = crypto.randomUUID();
  const tokenHash = await hashOpaqueToken(token);
  const expiresAt = new Date(
    Date.now() + EMAIL_VERIFICATION_TTL_HOURS * 60 * 60 * 1000
  ).toISOString();

  const [row] = await db
    .insert(emailVerificationTokens)
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

export async function consumeEmailVerificationToken(
  db: ReturnType<typeof drizzle>,
  token: string
): Promise<
  | { ok: true; userId: number; tokenId: number; emailVerifiedAt: string }
  | { ok: false; reason: "not_found" | "expired" | "verified" }
> {
  const tokenHash = await hashOpaqueToken(token);
  const [row] = await db
    .select({
      id: emailVerificationTokens.id,
      userId: emailVerificationTokens.userId,
      verifiedAt: emailVerificationTokens.verifiedAt,
      expiresAt: emailVerificationTokens.expiresAt,
    })
    .from(emailVerificationTokens)
    .where(eq(emailVerificationTokens.tokenHash, tokenHash))
    .limit(1);

  if (!row) return { ok: false, reason: "not_found" };

  const status = resolveEmailVerificationStatus({
    verifiedAt: row.verifiedAt,
    expiresAt: row.expiresAt,
  });
  if (status === "expired") return { ok: false, reason: "expired" };
  if (status === "verified") return { ok: false, reason: "verified" };

  const verifiedAt = new Date().toISOString();

  await db
    .update(emailVerificationTokens)
    .set({ verifiedAt })
    .where(
      and(
        eq(emailVerificationTokens.id, row.id),
        eq(emailVerificationTokens.tokenHash, tokenHash)
      )
    );

  await db
    .update(users)
    .set({ emailVerifiedAt: verifiedAt })
    .where(eq(users.id, row.userId));

  return { ok: true, userId: row.userId, tokenId: row.id, emailVerifiedAt: verifiedAt };
}
