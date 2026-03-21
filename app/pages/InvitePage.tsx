import { useLocation } from "wouter";
import { Panel } from "~/components/Panel";
import { useAcceptInvitation } from "~/hooks/useSession";
import { useHealth } from "~/hooks/useHealth";

function readInvitationId(): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("id")?.trim() ?? "";
}

export function InvitePage() {
  const [, navigate] = useLocation();
  const { data: health } = useHealth();
  const acceptInvitation = useAcceptInvitation();
  const invitationId = readInvitationId();
  const authMode = health?.authMode ?? "better-auth";

  if (authMode !== "better-auth") {
    return (
      <div className="mx-auto max-w-xl">
        <Panel
          title="Invitation Unavailable"
          subtitle="Organization invitations require AUTH_MODE=better-auth."
        >
          <p className="text-sm text-muted">
            This deployment is not using Better Auth, so invitation links cannot be accepted here.
          </p>
        </Panel>
      </div>
    );
  }

  if (!invitationId) {
    return (
      <div className="mx-auto max-w-xl">
        <Panel
          title="Invitation Link Invalid"
          subtitle="The invitation link is missing an invitation ID."
        >
          <p className="text-sm text-muted">
            Ask the inviter to resend the invitation and open the new link.
          </p>
        </Panel>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl">
      <Panel
        title="Accept Invitation"
        subtitle="Review the invitation and join the organization."
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-surface-alt p-4 text-sm text-muted">
            Invitation ID: {invitationId}
          </div>
          <button
            type="button"
            onClick={() =>
              acceptInvitation.mutate(invitationId, {
                onSuccess: () => navigate("/settings"),
              })
            }
            disabled={acceptInvitation.isPending}
            className="w-full rounded-xl bg-amber-400 px-4 py-3 font-semibold text-slate-950 disabled:opacity-50"
          >
            Accept Invitation
          </button>
          {acceptInvitation.error ? (
            <p className="text-sm text-error-text">
              {acceptInvitation.error.message}
            </p>
          ) : null}
        </div>
      </Panel>
    </div>
  );
}
