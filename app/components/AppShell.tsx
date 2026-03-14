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
    <div className="min-h-screen bg-gray-50 text-gray-800">
      <header className="border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-6">
            <Link
              href="/"
              className="text-lg font-bold tracking-tight text-gray-900"
            >
              cf-starter
            </Link>
            {session ? (
              <nav className="flex gap-1 overflow-x-auto">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`min-h-[44px] flex items-center rounded-lg px-4 py-2 text-base font-medium transition ${
                      (item.href === "/" ? location === "/" : location.startsWith(item.href))
                        ? "bg-amber-100 text-amber-800"
                        : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
                <Link
                  href="/settings"
                  className={`min-h-[44px] flex items-center rounded-lg px-4 py-2 text-base font-medium transition ${
                    location === "/settings"
                      ? "bg-amber-100 text-amber-800"
                      : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                  }`}
                >
                  Settings
                </Link>
              </nav>
            ) : null}
          </div>
          <div className="flex items-center gap-4">
            {session ? (
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-600">{session.name}</span>
                <button
                  type="button"
                  onClick={() => logout.mutate()}
                  className="rounded-lg bg-gray-100 px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-200 hover:text-gray-900"
                >
                  Logout
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>
      <main className="px-6 py-8">{children}</main>
    </div>
  );
}
