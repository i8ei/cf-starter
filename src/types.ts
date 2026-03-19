import type { JobMessage } from "./queues/types";

export interface Env {
  DB: D1Database;
  KV?: KVNamespace;
  BUCKET: R2Bucket;
  RATE_LIMITER?: DurableObjectNamespace;
  JOBS?: Queue<JobMessage>;
  ASSETS: Fetcher;
  CORS_ORIGIN?: string;
  COOKIE_SAME_SITE?: string;
  COOKIE_SECURE?: string;
  APP_BASE_URL?: string;
  EMAIL_PROVIDER?: string;
  EMAIL_FROM?: string;
  EMAIL_REPLY_TO?: string;
  RESEND_API_KEY?: string;
  AUTH_ENABLED?: string;
  AUTH_MODE?: string;
  ADMIN_PASSWORD?: string;
  BETTER_AUTH_SECRET?: string;
}

export interface AppVariables {
  requestId: string;
  sessionId?: string;
  userId?: string;
  roles?: string[];
  orgId?: string;
  orgRole?: string;
}

export type AppContextEnv = {
  Bindings: Env;
  Variables: AppVariables;
};
