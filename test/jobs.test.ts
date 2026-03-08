import { describe, expect, it, vi } from "vitest";
import { enqueueJob, handleJobBatch } from "../src/queues/jobs";
import { createJobQueue, createTestEnv } from "./helpers";

describe("jobs", () => {
  it("enqueues a job through the queue binding", async () => {
    const jobs = createJobQueue();

    await enqueueJob(jobs.queue, {
      type: "user.welcome",
      payload: {
        userId: 1,
        email: "hello@example.com",
        name: "Hello",
        requestId: "req_123",
      },
    });

    expect(jobs.messages).toHaveLength(1);
    expect(jobs.messages[0]?.type).toBe("user.welcome");
  });

  it("acks handled queue messages", async () => {
    const ack = vi.fn();
    const retry = vi.fn();

    await handleJobBatch(
      {
        messages: [
          {
            id: "msg_1",
            body: {
              type: "upload.process",
              payload: {
                key: "uploads/test.txt",
                size: 12,
                contentType: "text/plain",
                requestId: "req_456",
              },
            },
            ack,
            retry,
          },
        ],
      } as never,
      createTestEnv()
    );

    expect(ack).toHaveBeenCalledTimes(1);
    expect(retry).not.toHaveBeenCalled();
  });
});
