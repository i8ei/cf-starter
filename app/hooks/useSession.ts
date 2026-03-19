import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { client } from "../lib/api";
import { readApiError } from "../lib/errors";
import { authClient } from "../lib/auth-client";

const SESSION_QUERY_KEY = ["session"] as const;
const ORGANIZATIONS_QUERY_KEY = ["organizations"] as const;

export type SessionData = {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  createdAt: string;
  roles: string[];
  currentOrganizationId: string | null;
  organizationRole: string | null;
};

export function useSession() {
  return useQuery({
    queryKey: SESSION_QUERY_KEY,
    retry: false,
    queryFn: async () => {
      const res = await client.api.auth.me.$get();
      if (res.status === 401) return null;
      if (!res.ok) throw new Error(await readApiError(res, "Failed to load session"));
      return (await res.json()) as SessionData;
    },
  });
}

export function useSignup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { email: string; password: string; name: string }) => {
      const result = await authClient.signUp.email({
        email: input.email,
        password: input.password,
        name: input.name,
      });
      if (result.error) throw new Error(result.error.message ?? "Failed to sign up");
      return result.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: ORGANIZATIONS_QUERY_KEY });
    },
  });
}

export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { email: string; password: string }) => {
      const result = await authClient.signIn.email({
        email: input.email,
        password: input.password,
      });
      if (result.error) throw new Error(result.error.message ?? "Failed to log in");
      return result.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: ORGANIZATIONS_QUERY_KEY });
    },
  });
}

export function useAdminLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (password: string) => {
      const res = await client.api.auth["admin-login"].$post({
        json: { password },
      });
      if (!res.ok) throw new Error(await readApiError(res, "Failed to log in"));
      return res.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await client.api.auth.logout.$post();
      if (!res.ok) throw new Error(await readApiError(res, "Failed to log out"));
      return res.json();
    },
    onSuccess: () => {
      queryClient.setQueryData(SESSION_QUERY_KEY, null);
      void queryClient.invalidateQueries({ queryKey: ORGANIZATIONS_QUERY_KEY });
    },
  });
}

// Organization hooks — uses Better Auth organization plugin client

export function useListOrganizations() {
  return authClient.useListOrganizations();
}

export function useActiveOrganization() {
  return authClient.useActiveOrganization();
}

export function useCreateOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { name: string; slug?: string }) => {
      const slug = input.slug ?? input.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
      const result = await authClient.organization.create({
        name: input.name,
        slug,
      });
      if (result.error) throw new Error(result.error.message ?? "Failed to create organization");
      return result.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: ORGANIZATIONS_QUERY_KEY });
    },
  });
}

export function useSetActiveOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (organizationId: string) => {
      const result = await authClient.organization.setActive({
        organizationId,
      });
      if (result.error) throw new Error(result.error.message ?? "Failed to switch organization");
      return result.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: ORGANIZATIONS_QUERY_KEY });
    },
  });
}

export function useInviteMember() {
  return useMutation({
    mutationFn: async (input: { email: string; role: string; organizationId: string }) => {
      const result = await authClient.organization.inviteMember({
        email: input.email,
        role: input.role as "member" | "admin" | "owner",
        organizationId: input.organizationId,
      });
      if (result.error) throw new Error(result.error.message ?? "Failed to invite member");
      return result.data;
    },
  });
}

export function useAcceptInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (invitationId: string) => {
      const result = await authClient.organization.acceptInvitation({
        invitationId,
      });
      if (result.error) throw new Error(result.error.message ?? "Failed to accept invitation");
      return result.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: ORGANIZATIONS_QUERY_KEY });
    },
  });
}
