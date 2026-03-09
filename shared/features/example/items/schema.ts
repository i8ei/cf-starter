import { z } from "zod";

export const createItemSchema = z.object({
  name: z.string().min(1).max(200),
});

export type CreateItemInput = z.infer<typeof createItemSchema>;
