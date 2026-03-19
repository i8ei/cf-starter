import { describe, expect, it, vi } from "vitest";
import { enqueueJob, handleJobBatch } from "../src/queues/jobs";
import { createJobQueue, createTestEnv } from "./helpers";

describe("jobs", () => {
  it("enqueues a job through the queue binding", async () => {
    const jobs = createJobQueue();

    await enqueueJob(jobs.queue, {
      type: "user.welcome",
      payload: {
        userId: "1",
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
                organizationId: "4",
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

  it("acks organization invite email jobs", async () => {
    const ack = vi.fn();
    const retry = vi.fn();

    await handleJobBatch(
      {
        messages: [
          {
            id: "msg_2",
            body: {
              type: "organization.invite_email",
              payload: {
                organizationId: "7",
                organizationName: "Taracho Ops",
                inviteId: "11",
                email: "member@example.com",
                role: "member",
                inviteUrl: "https://starter.example.com/?inviteToken=abc",
                requestId: "req_789",
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

  it("sends invite emails through Resend when configured", async () => {
    const ack = vi.fn();
    const retry = vi.fn();
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "re_invite" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );

    await handleJobBatch(
      {
        messages: [
          {
            id: "msg_5",
            body: {
              type: "organization.invite_email",
              payload: {
                organizationId: "9",
                organizationName: "Starter Org",
                inviteId: "12",
                email: "member@example.com",
                role: "member",
                inviteUrl: "https://starter.example.com/?inviteToken=abc",
                requestId: "req_resend",
              },
            },
            ack,
            retry,
          },
        ],
      } as never,
      createTestEnv({
        EMAIL_PROVIDER: "resend",
        EMAIL_FROM: "Starter <noreply@example.com>",
        RESEND_API_KEY: "re_test",
      })
    );

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(ack).toHaveBeenCalledTimes(1);
    expect(retry).not.toHaveBeenCalled();
  });
});
