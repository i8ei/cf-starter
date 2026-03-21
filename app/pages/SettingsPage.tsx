import { useState } from "react";
import { Panel } from "~/components/Panel";
import {
  useSession,
  useLogout,
  useListOrganizations,
  useCreateOrganization,
  useSetActiveOrganization,
  useInviteMember,
  useAcceptInvitation,
} from "~/hooks/useSession";
import type { SessionData } from "~/hooks/useSession";
import { useHealth } from "~/hooks/useHealth";

export function SettingsPage() {
  const { data: session } = useSession();
  const { data: health } = useHealth();
  const logout = useLogout();

  if (!session) return null;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Panel title="Session">
        <div className="space-y-2 text-sm text-muted">
          <div>
            {session.name} &middot; {session.email}
          </div>
          <div>roles: {session.roles.join(", ")}</div>
          <div>organizationRole: {session.organizationRole ?? "none"}</div>
          <div>
            emailVerified:{" "}
            {session.emailVerified ? "yes" : "pending"}
          </div>
        </div>
        <button
          type="button"
          onClick={() => logout.mutate()}
          disabled={logout.isPending}
          className="mt-4 rounded-xl bg-rose-400 px-4 py-3 font-semibold text-slate-950 disabled:opacity-50"
        >
          Log Out
        </button>
      </Panel>

      {(health?.authMode as string) === "better-auth" ? (
        <BetterAuthSettings session={session} />
      ) : null}
    </div>
  );
}

function BetterAuthSettings({ session }: { session: SessionData }) {
  const [orgName, setOrgName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<string>("member");
  const [invitationId, setInvitationId] = useState("");
  const { data: orgsData } = useListOrganizations();
  const createOrganization = useCreateOrganization();
  const setActiveOrg = useSetActiveOrganization();
  const inviteMember = useInviteMember();
  const acceptInvitation = useAcceptInvitation();

  const organizations = orgsData ?? [];

  return (
    <>
      <Panel
        title="Organizations"
        subtitle="Switch, create, or manage organizations."
      >
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-3">
            <div className="text-sm text-muted">Your Organizations</div>
            <div className="space-y-2">
              {organizations.map((org) => (
                <button
                  key={org.id}
                  type="button"
                  onClick={() => setActiveOrg.mutate(org.id)}
                  className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left ${
                    session.currentOrganizationId === org.id
                      ? "border-amber-300 bg-amber-50"
                      : "border-border bg-surface-alt"
                  }`}
                >
                  <span>
                    <span className="block font-medium text-heading">
                      {org.name}
                    </span>
                    <span className="block text-sm text-muted">
                      {org.slug}
                    </span>
                  </span>
                </button>
              ))}
              {organizations.length === 0 ? (
                <p className="text-sm text-muted">No organizations yet.</p>
              ) : null}
            </div>
          </div>
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-surface-alt p-4">
              <div className="mb-3 text-sm text-muted">
                Create Organization
              </div>
              <div className="flex gap-2">
                <input
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="Organization name"
                  className="flex-1 rounded-lg border border-input-border bg-input-bg px-4 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!orgName.trim()) return;
                    createOrganization.mutate(
                      { name: orgName.trim() },
                      { onSuccess: () => setOrgName("") }
                    );
                  }}
                  disabled={createOrganization.isPending}
                  className="rounded-xl bg-cyan-300 px-4 py-3 font-semibold text-slate-950 disabled:opacity-50"
                >
                  Create
                </button>
              </div>
              {createOrganization.error ? (
                <p className="mt-2 text-sm text-error-text">
                  {createOrganization.error.message}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </Panel>

      <Panel title="Invitations" subtitle="Invite members or accept invitations.">
        <div className="grid gap-6 lg:grid-cols-2">
          {session.currentOrganizationId ? (
            <div className="space-y-3">
              <div className="text-sm text-muted">Invite Member</div>
              <input
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="user@example.com"
                className="w-full rounded-lg border border-input-border bg-input-bg px-4 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="w-full rounded-lg border border-input-border bg-input-bg px-4 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="member">member</option>
                <option value="admin">admin</option>
              </select>
              <button
                type="button"
                onClick={() => {
                  if (!inviteEmail.trim() || !session.currentOrganizationId) return;
                  inviteMember.mutate(
                    {
                      email: inviteEmail.trim(),
                      role: inviteRole,
                      organizationId: session.currentOrganizationId,
                    },
                    { onSuccess: () => setInviteEmail("") }
                  );
                }}
                disabled={inviteMember.isPending}
                className="w-full rounded-xl bg-amber-400 px-4 py-3 font-semibold text-slate-950 disabled:opacity-50"
              >
                Invite
              </button>
              {inviteMember.error ? (
                <p className="mt-2 text-sm text-error-text">
                  {inviteMember.error.message}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-muted">
              Select an organization to invite members.
            </p>
          )}
          <div className="space-y-3">
            <div className="text-sm text-muted">Accept Invitation</div>
            <input
              value={invitationId}
              onChange={(e) => setInvitationId(e.target.value)}
              placeholder="Invitation ID"
              className="w-full rounded-lg border border-input-border bg-input-bg px-4 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <button
              type="button"
              onClick={() => {
                if (!invitationId.trim()) return;
                acceptInvitation.mutate(invitationId.trim(), {
                  onSuccess: () => setInvitationId(""),
                });
              }}
              disabled={acceptInvitation.isPending}
              className="w-full rounded-xl bg-fuchsia-300 px-4 py-3 font-semibold text-slate-950 disabled:opacity-50"
            >
              Accept
            </button>
            {acceptInvitation.error ? (
              <p className="mt-2 text-sm text-error-text">
                {acceptInvitation.error.message}
              </p>
            ) : null}
          </div>
        </div>
      </Panel>
    </>
  );
}
