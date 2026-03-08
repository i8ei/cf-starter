import type { Env } from "../types";
import { logEvent } from "../lib/logging";
import type { JobMessage } from "./types";

export async function enqueueJob(queue: Queue<JobMessage>, message: JobMessage) {
  await queue.send(message);
}

export async function handleJobBatch(
  batch: MessageBatch<JobMessage>,
  _env: Env
): Promise<void> {
  for (const message of batch.messages) {
    try {
      switch (message.body.type) {
        case "user.welcome":
          logEvent("info", "queue.user_welcome", {
            userId: message.body.payload.userId,
            email: message.body.payload.email,
            requestId: message.body.payload.requestId,
          });
          break;
        case "upload.process":
          logEvent("info", "queue.upload_process", {
            key: message.body.payload.key,
            size: message.body.payload.size,
            requestId: message.body.payload.requestId,
          });
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
