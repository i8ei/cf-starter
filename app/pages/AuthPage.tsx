import { useState } from "react";
import { Panel } from "~/components/Panel";
import {
  useLogin,
  useAdminLogin,
  useSignup,
} from "~/hooks/useSession";

type AuthMode = "simple-admin" | "better-auth";

export function AuthPage({ authMode }: { authMode: AuthMode }) {
  if (authMode === "simple-admin") {
    return <SimpleAdminAuth />;
  }
  return <FullAuth />;
}

function SimpleAdminAuth() {
  const [password, setPassword] = useState("");
  const adminLogin = useAdminLogin();

  const handleSubmit = () => {
    if (!password.trim()) return;
    adminLogin.mutate(password);
  };

  const inputClass =
    "w-full rounded-lg border border-input-border bg-input-bg px-4 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div className="mx-auto max-w-sm">
      <Panel title="Admin Login" subtitle="Enter the admin password to continue.">
        <div className="space-y-3">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder="Password"
            className={inputClass}
            autoFocus
          />
          <button
            type="button"
            onClick={handleSubmit}
            disabled={adminLogin.isPending}
            className="w-full rounded-xl bg-amber-400 px-4 py-3 font-semibold text-slate-950 disabled:opacity-50"
          >
            Log In
          </button>
          {adminLogin.error ? (
            <p className="text-sm text-error-text">
              {adminLogin.error.message}
            </p>
          ) : null}
        </div>
      </Panel>
    </div>
  );
}

function FullAuth() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const login = useLogin();
  const signup = useSignup();

  const currentMutation = mode === "login" ? login : signup;

  const handleSubmit = () => {
    if (mode === "login") {
      login.mutate({ email, password });
      return;
    }
    signup.mutate({ email, password, name });
  };

  const inputClass =
    "w-full rounded-lg border border-input-border bg-input-bg px-4 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div className="mx-auto max-w-sm">
      <Panel
        title="Authentication"
        subtitle="Login or create an account to get started."
      >
        <div className="mb-4 flex gap-2">
          {(["login", "signup"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              className={`rounded-full px-4 py-2 text-sm font-medium ${
                mode === value
                  ? "bg-amber-400 text-slate-950"
                  : "bg-surface text-muted"
              }`}
            >
              {value}
            </button>
          ))}
        </div>
        <div className="space-y-3">
          {mode === "signup" ? (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
              className={inputClass}
            />
          ) : null}
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className={inputClass}
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder="Password"
            className={inputClass}
          />
          <button
            type="button"
            onClick={handleSubmit}
            disabled={currentMutation.isPending}
            className="w-full rounded-xl bg-amber-400 px-4 py-3 font-semibold text-slate-950 disabled:opacity-50"
          >
            {mode === "login" ? "Log In" : "Create Account"}
          </button>
          {currentMutation.error ? (
            <p className="text-sm text-error-text">
              {currentMutation.error.message}
            </p>
          ) : null}
        </div>
      </Panel>
    </div>
  );
}
