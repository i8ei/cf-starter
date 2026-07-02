/**
 * Workers AI API route example — optional addon, disabled by default.
 *
 * Enable in wrangler.jsonc:
 *   "ai": { "binding": "AI" }
 *
 * Keep this route if you need a minimal Workers AI integration point.
 * Delete this file and its mount in src/index.ts when you don't need it.
 */
import { Hono } from "hono";
import type { AppContextEnv } from "../types";
import { jsonError } from "../lib/http";
import { validator } from "../lib/validator";
import { rateLimit } from "../middleware/rate-limit";
import { requireAuth } from "../middleware/auth";
import { aiPromptSchema, type AiResponse } from "../../shared/schemas/ai";

type WorkersAiTextGenerationResult = {
  response?: string;
};

const MODEL = "@cf/meta/llama-3.1-8b-instruct-fp8";

// requireAuth: Workers AI calls spend account credits — never expose them to
// anonymous traffic. Per-IP rate limiting alone doesn't survive IP rotation.
const aiExample = new Hono<AppContextEnv>().post(
  "/prompt",
  rateLimit({ namespace: "ai-example-prompt", maxRequests: 20, windowSeconds: 60 }),
  requireAuth,
  validator("json", aiPromptSchema),
  async (c) => {
    if (!c.env.AI) {
      return jsonError(c, 503, "ai_not_configured", "Workers AI binding is not configured");
    }

    const { prompt } = c.req.valid("json");
    const result = await c.env.AI.run(MODEL, { prompt }) as WorkersAiTextGenerationResult;

    return c.json({
      response: result.response ?? "",
    } satisfies AiResponse);
  },
);

export default aiExample;
