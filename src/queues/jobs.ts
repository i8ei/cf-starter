import type { Env } from "../types";
import {
  buildInviteEmail,
  buildWelcomeEmail,
  sendEmail,
} from "../lib/email";
import { resolveAppBaseUrl } from "../lib/config";
import { logEvent } from "../lib/logging";
import type { JobMessage } from "./types";

type OrganizationInviteEmailPayload = Extract<
  JobMessage,
  { type: "organization.invite_email" }
>["payload"];

/** Replace token values in URLs with [REDACTED] to prevent secret leakage in logs. */
function redactUrlToken(url: string): string {
  try {
    const parsed = new URL(url);
    for (const key of [...parsed.searchParams.keys()]) {
      if (/token/i.test(key)) {
        parsed.searchParams.set(key, "[REDACTED]");
      }
    }
    return parsed.toString();
  } catch {
    // If the URL can't be parsed, redact the whole thing
    return "[REDACTED_URL]";
  }
}

export async function enqueueJob(
  queue: Queue<JobMessage> | undefined,
  message: JobMessage
) {
  if (!queue) return;
  await queue.send(message);
}

async function deliverOrganizationInviteEmail(
  env: Env,
  payload: OrganizationInviteEmailPayload
) {
  const content = buildInviteEmail({
    organizationName: payload.organizationName,
    role: payload.role,
    inviteUrl: payload.inviteUrl,
  });
  const delivery = await sendEmail(env, {
    to: payload.email,
    subject: content.subject,
    html: content.html,
    text: content.text,
    requestId: payload.requestId,
    idempotencyKey: `organization-invite:${payload.inviteId}`,
  });
  logEvent("info", "queue.organization_invite_email", {
    organizationId: payload.organizationId,
    organizationName: payload.organizationName,
    inviteId: payload.inviteId,
    email: payload.email,
    role: payload.role,
    inviteUrl: redactUrlToken(payload.inviteUrl),
    delivery: delivery.delivery,
    providerMessageId: delivery.id ?? null,
    requestId: payload.requestId,
  });
}

export async function sendOrganizationInvite(
  env: Env,
  payload: OrganizationInviteEmailPayload
) {
  if (env.JOBS) {
    await enqueueJob(env.JOBS, {
      type: "organization.invite_email",
      payload,
    });
    return;
  }

  await deliverOrganizationInviteEmail(env, payload);
}

export async function handleJobBatch(
  batch: MessageBatch<JobMessage>,
  env: Env
): Promise<void> {
  for (const message of batch.messages) {
    try {
      switch (message.body.type) {
        case "user.welcome":
          {
            const content = buildWelcomeEmail({
              name: message.body.payload.name,
              appBaseUrl: resolveAppBaseUrl(env),
            });
            const delivery = await sendEmail(env, {
              to: message.body.payload.email,
              subject: content.subject,
              html: content.html,
              text: content.text,
              requestId: message.body.payload.requestId,
              idempotencyKey: `user-welcome:${message.body.payload.userId}`,
            });
            logEvent("info", "queue.user_welcome", {
              userId: message.body.payload.userId,
              email: message.body.payload.email,
              delivery: delivery.delivery,
              providerMessageId: delivery.id ?? null,
              requestId: message.body.payload.requestId,
            });
          }
          break;
        case "upload.process":
          logEvent("info", "queue.upload_process", {
            key: message.body.payload.key,
            organizationId: message.body.payload.organizationId,
            size: message.body.payload.size,
            requestId: message.body.payload.requestId,
          });
          break;
        case "organization.invite_email":
          {
            await deliverOrganizationInviteEmail(env, message.body.payload);
          }
          break;
        default:
          throw new Error("unknown job type");
      }

      message.ack();
    } catch (error) {
      logEvent("error", "queue.job_failed", {
        messageId: message.id,
        message: error instanceof Error ? error.message : String(error),
      });
      message.retry();
    }
  }
}
