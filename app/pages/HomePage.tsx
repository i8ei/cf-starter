import { useSession } from "../hooks/useSession";
import { Panel } from "../components/Panel";

export function HomePage() {
  const { data: session } = useSession();
  const primaryOrg = session?.organizations?.[0];

  const nextSteps = [
    "Add your first domain route under src/routes/.",
    "Generate records with npm run record:generate when CRUD screens are needed.",
    "Run npm run seed:demo to create a local demo user and organization.",
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold text-heading">Welcome to cf-starter</h1>

      <Panel title="Starter Core" subtitle="Auth, org context, DB, queues, and typed API are ready.">
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Starter 本体は example UI を初期表示しません。必要な feature pack だけ残すか、自分の業務機能へ置き換える前提です。
          </p>
          <div className="rounded-lg border border-border bg-surface px-4 py-3 text-sm text-muted">
            <p>Current user: {session?.email ?? "not signed in"}</p>
            <p>Current organization: {primaryOrg?.organizationName ?? "none"}</p>
          </div>
          <ul className="space-y-2 text-sm text-muted">
            {nextSteps.map((step) => (
              <li
                key={step}
                className="rounded-lg border border-border bg-surface px-4 py-3"
              >
                {step}
              </li>
            ))}
          </ul>
        </div>
      </Panel>
    </div>
  );
}
