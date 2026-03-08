import type { JobMessage } from "./queues/types";

export interface Env {
  DB: D1Database;
  KV: KVNamespace;
  BUCKET: R2Bucket;
  RATE_LIMITER: DurableObjectNamespace;
  JOBS: Queue<JobMessage>;
  ASSETS: Fetcher;
  CORS_ORIGIN?: string;
  COOKIE_SAME_SITE?: string;
  COOKIE_SECURE?: string;
}

export interface AppVariables {
  requestId: string;
  userId?: number;
  roles?: string[];
}

export type AppContextEnv = {
  Bindings: Env;
  Variables: AppVariables;
};
