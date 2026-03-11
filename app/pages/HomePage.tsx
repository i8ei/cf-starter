import { useSession } from "../hooks/useSession";
import { Panel } from "../components/Panel";

export function HomePage() {
  const { data: session } = useSession();
  const primaryOrg = session?.memberships?.[0];

  const nextSteps = [
    "Add your first domain route under src/routes or examples/feature-packs.",
    "Generate records with npm run record:generate when CRUD screens are needed.",
    "Run npm run seed:demo if you want a local login baseline.",
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold text-white">Welcome to cf-starter</h1>

      <Panel title="Starter Core" subtitle="Auth, org context, DB, queues, and typed API are ready.">
        <div className="space-y-4">
          <p className="text-sm text-slate-300">
            Starter 本体は example UI を初期表示しません。必要な feature pack だけ残すか、自分の業務機能へ置き換える前提です。
          </p>
          <div className="rounded-lg border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-slate-300">
            <p>Current user: {session?.user.email ?? "not signed in"}</p>
            <p>Current organization: {primaryOrg?.organization.name ?? "none"}</p>
          </div>
          <ul className="space-y-2 text-sm text-slate-300">
            {nextSteps.map((step) => (
              <li
                key={step}
                className="rounded-lg border border-white/10 bg-slate-950/40 px-4 py-3"
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
