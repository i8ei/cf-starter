import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { client } from "../../../../../app/lib/api";
import { readApiError } from "../../../../../app/lib/errors";

const ITEMS_KEY = ["items"] as const;

export type ItemRecord = {
  id: number;
  organizationId: number | null;
  name: string;
  createdAt: string;
};

export function useItems(enabled: boolean) {
  return useQuery({
    queryKey: ITEMS_KEY,
    enabled,
    queryFn: async () => {
      const res = await client.api.items.$get();
      if (!res.ok) throw new Error(await readApiError(res, "Failed to fetch items"));
      return (await res.json()) as ItemRecord[];
    },
  });
}

export function useCreateItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const res = await client.api.items.$post({ json: { name } });
      if (!res.ok) throw new Error(await readApiError(res, "Failed to create item"));
      return (await res.json()) as ItemRecord;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ITEMS_KEY }),
  });
}

export function useUpdateItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name }: { id: number; name: string }) => {
      const res = await client.api.items[":id"].$put({
        param: { id: String(id) },
        json: { name },
      });
      if (!res.ok) throw new Error(await readApiError(res, "Failed to update item"));
      return (await res.json()) as ItemRecord;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ITEMS_KEY }),
  });
}

export function useDeleteItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await client.api.items[":id"].$delete({
        param: { id: String(id) },
      });
      if (!res.ok) throw new Error(await readApiError(res, "Failed to delete item"));
      return (await res.json()) as { ok: true };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ITEMS_KEY }),
  });
}

