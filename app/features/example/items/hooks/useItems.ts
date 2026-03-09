import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { client } from "../../../../lib/api";
import { readApiError } from "../../../../lib/errors";

export type ItemRecord = {
  id: number;
  organizationId: number | null;
  name: string;
  createdAt: string;
};

export function useItems(enabled: boolean) {
  return useQuery({
    queryKey: ["items"],
    enabled,
    queryFn: async () => {
      const res = await client.api.items.$get();
      if (!res.ok) throw new Error(await readApiError(res, "Failed to fetch items"));
      return (await res.json()) as ItemRecord[];
    },
  });
}

export function useCreateItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string) => {
      const res = await client.api.items.$post({ json: { name } });
      if (!res.ok) throw new Error(await readApiError(res, "Failed to create item"));
      return (await res.json()) as ItemRecord;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["items"] });
    },
  });
}
