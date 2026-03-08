import { RateLimiter } from "../src/durable-objects/rate-limiter";
import type { Env } from "../src/types";

class FakeDurableObjectStorage {
  private data = new Map<string, unknown>();
  alarm: number | null = null;

  async get<T>(key: string): Promise<T | undefined> {
    return this.data.get(key) as T | undefined;
  }

  async put<T>(key: string, value: T): Promise<void> {
    this.data.set(key, value);
  }

  async setAlarm(timestamp: number): Promise<void> {
    this.alarm = timestamp;
  }

  async deleteAll(): Promise<void> {
    this.data.clear();
  }
}

function toRequest(input: RequestInfo | URL, init?: RequestInit): Request {
  if (input instanceof Request) return input;
  return new Request(input, init);
}

export function createRateLimiterNamespace(): DurableObjectNamespace {
  const objects = new Map<string, RateLimiter>();

  return {
    idFromName(name: string) {
      return name as unknown as DurableObjectId;
    },
    get(id: DurableObjectId) {
      const key = String(id);
      let object = objects.get(key);
      if (!object) {
        object = new RateLimiter({
          storage: new FakeDurableObjectStorage(),
        } as unknown as DurableObjectState);
        objects.set(key, object);
      }

      return {
        fetch: (input: RequestInfo | URL, init?: RequestInit) =>
          object!.fetch(toRequest(input, init)),
      } as DurableObjectStub;
    },
  } as DurableObjectNamespace;
}

export function createTestEnv(overrides: Partial<Env> = {}): Env {
  return {
    DB: {} as D1Database,
    KV: {
      get: async () => null,
    } as KVNamespace,
    BUCKET: {
      head: async () => null,
    } as R2Bucket,
    RATE_LIMITER: createRateLimiterNamespace(),
    ASSETS: {
      fetch: async () => new Response("not found", { status: 404 }),
    } as Fetcher,
    CORS_ORIGIN: "http://localhost:5173",
    COOKIE_SAME_SITE: "Lax",
    COOKIE_SECURE: "true",
    ...overrides,
  };
}
