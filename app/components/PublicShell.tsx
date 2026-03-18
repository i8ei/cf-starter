import { Link, useLocation } from "wouter";
import { useState } from "react";

interface PublicShellProps {
  children: React.ReactNode;
  title?: string;
  navItems?: { href: string; label: string }[];
  /** Extra elements in the header (e.g. year selector, toggle) */
  headerExtra?: React.ReactNode;
}

/**
 * Mobile-first single-column layout for public (AUTH_ENABLED=false) apps.
 * Use AppShell for authenticated apps with sidebar navigation.
 */
export function PublicShell({
  children,
  title = "cf-starter",
  navItems = [],
  headerExtra,
}: PublicShellProps) {
  const [location] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-base font-bold text-heading no-underline">
              {title}
            </Link>
            <div className="flex items-center gap-2">
              {headerExtra}
              {navItems.length > 0 && (
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="sm:hidden text-muted p-1"
                  aria-label="メニュー"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {menuOpen ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    )}
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Desktop nav */}
          {navItems.length > 0 && (
            <nav className="hidden sm:flex gap-1 mt-2">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-1.5 text-sm rounded-lg no-underline transition-colors ${
                    location === item.href
                      ? "bg-blue-600 text-white font-medium"
                      : "text-muted hover:bg-surface-hover"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          )}

          {/* Mobile nav */}
          {menuOpen && navItems.length > 0 && (
            <nav className="sm:hidden flex flex-col gap-1 mt-2 pb-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className={`px-3 py-2 text-sm rounded-lg no-underline transition-colors ${
                    location === item.href
                      ? "bg-blue-600 text-white font-medium"
                      : "text-body hover:bg-surface-hover"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="max-w-2xl mx-auto px-4 pb-16">
        {children}
      </main>
    </div>
  );
}
