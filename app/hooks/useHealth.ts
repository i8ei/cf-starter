import { useQuery } from "@tanstack/react-query";
import { client } from "../lib/api";
import type { HealthResponse } from "@shared/schemas/health";

export function useHealth() {
  return useQuery({
    queryKey: ["health"],
    queryFn: async () => {
      const res = await client.api.health.$get();
      if (!res.ok) throw new Error("Health check failed");
      return (await res.json()) as HealthResponse;
    },
  });
}
