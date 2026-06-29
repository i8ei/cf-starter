import { z } from "zod";

export const aiPromptSchema = z.object({
  prompt: z.string().min(1).max(4000),
});

export interface AiResponse {
  response: string;
}
