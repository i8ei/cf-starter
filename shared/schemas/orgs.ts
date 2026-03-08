import { z } from "zod";

export const createOrganizationSchema = z.object({
  name: z.string().min(1).max(100),
});

export const switchOrganizationSchema = z.object({
  organizationId: z.number().int().positive(),
});

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
export type SwitchOrganizationInput = z.infer<typeof switchOrganizationSchema>;
