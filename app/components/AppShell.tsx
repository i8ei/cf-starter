import { Link, useLocation } from "wouter";
import { useSession, useLogout } from "~/hooks/useSession";

export function AppShell({
  children,
  navItems = [],
}: {
  children: React.ReactNode;
  navItems?: { label: string; href: string }[];
}) {
  const { data: session } = useSession();
  const logout = useLogout();
  const [location] = useLocation();

  return (
    <div className="min-h-screen bg-surface-alt text-body">
      <header className="border-b border-border bg-surface shadow-sm">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex items-center justify-between py-4">
            <Link
              href="/"
              className="text-lg font-bold tracking-tight text-heading"
            >
              cf-starter
            </Link>
            {session ? (
              <div className="flex items-center gap-3">
                <span className="hidden sm:inline text-sm text-muted">{session.name}</span>
                <button
                  type="button"
                  onClick={() => logout.mutate()}
                  className="rounded-lg bg-surface-hover px-3 py-1.5 text-sm text-muted hover:bg-surface-alt hover:text-heading"
                >
                  ログアウト
                </button>
              </div>
            ) : null}
          </div>
          {session ? (
            <nav className="flex gap-1 overflow-x-auto pb-3">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`whitespace-nowrap min-h-[44px] flex items-center rounded-lg px-4 py-2 text-base font-medium transition ${
                    (item.href === "/" ? location === "/" : location.startsWith(item.href))
                      ? "bg-amber-100 text-amber-800"
                      : "text-muted hover:bg-surface-hover hover:text-heading"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
              <Link
                href="/settings"
                className={`whitespace-nowrap min-h-[44px] flex items-center rounded-lg px-4 py-2 text-base font-medium transition ${
                  location === "/settings"
                    ? "bg-amber-100 text-amber-800"
                    : "text-muted hover:bg-surface-hover hover:text-heading"
                }`}
              >
                設定
              </Link>
            </nav>
          ) : null}
        </div>
      </header>
      <main className="px-6 py-8">{children}</main>
    </div>
  );
}
