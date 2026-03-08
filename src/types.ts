export interface Env {
  DB: D1Database;
  KV: KVNamespace;
  BUCKET: R2Bucket;
  ASSETS: Fetcher;
  CORS_ORIGIN?: string;
  COOKIE_SAME_SITE?: string;
  COOKIE_SECURE?: string;
}
