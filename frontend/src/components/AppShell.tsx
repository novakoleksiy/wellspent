import { useEffect, useRef, useState, type ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

type AppShellProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
};

const links = [
  { to: "/", label: "Homepage" },
  { to: "/explore", label: "Explore" },
  { to: "/trips", label: "My Trips" },
];

function navClass(isActive: boolean): string {
  return isActive
    ? "rounded-full bg-[var(--ws-orange)] px-4 py-2 text-sm font-semibold !text-white shadow-sm"
    : "rounded-full px-4 py-2 text-sm font-medium text-[var(--ws-muted)] transition hover:bg-white/70 hover:text-[var(--ws-ink)]";
}

export default function AppShell({
  title,
  description,
  actions,
  children,
}: AppShellProps) {
  const { user, logout } = useAuth();
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const initials = user?.full_name
    ?.split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  useEffect(() => {
    if (!isProfileMenuOpen) {
      return undefined;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && profileMenuRef.current?.contains(event.target)) {
        return;
      }

      setIsProfileMenuOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsProfileMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isProfileMenuOpen]);

  return (
    <div className="ws-app-bg min-h-screen text-[var(--ws-ink)]">
      <header className="sticky top-0 z-30 border-b border-[var(--ws-line)] bg-[rgba(244,241,234,0.92)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-4">
            <NavLink to="/" className="flex items-center gap-3">
              <img className="ws-logo" src="/landing/logo.png" alt="Wellspent" />
            </NavLink>
          </div>

          <nav className="hidden items-center gap-2 rounded-full border border-[var(--ws-line)] bg-white/70 p-1 shadow-sm md:flex">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === "/"}
                className={({ isActive }) => navClass(isActive)}
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          <div ref={profileMenuRef} className="relative shrink-0">
            <button
              type="button"
              onClick={() => setIsProfileMenuOpen((open) => !open)}
              className="flex items-center gap-3 rounded-full border border-[var(--ws-line)] bg-white/85 px-3 py-2 text-left shadow-sm transition hover:border-[rgba(20,19,15,0.24)]"
              aria-expanded={isProfileMenuOpen}
              aria-haspopup="menu"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--ws-orange)] text-sm font-semibold text-white shadow-lg shadow-orange-950/15">
                {initials || "WS"}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-[var(--ws-ink)]">{user?.full_name}</p>
              </div>
            </button>

            {isProfileMenuOpen && (
              <div className="absolute right-0 top-full z-40 mt-3 w-60 rounded-3xl border border-[var(--ws-line)] bg-[#fffdf8]/95 p-2 shadow-xl shadow-stone-300/50 backdrop-blur">
                <NavLink
                  to="/settings"
                  onClick={() => setIsProfileMenuOpen(false)}
                  className="block rounded-2xl px-4 py-3 text-sm font-medium text-[var(--ws-muted)] transition hover:bg-[var(--ws-cream)] hover:text-[var(--ws-ink)]"
                >
                  My Profile
                </NavLink>
                <button
                  type="button"
                  onClick={() => {
                    setIsProfileMenuOpen(false);
                    logout();
                  }}
                  className="block w-full rounded-2xl px-4 py-3 text-left text-sm font-medium text-[var(--ws-muted)] transition hover:bg-[var(--ws-cream)] hover:text-[var(--ws-ink)]"
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 pb-28 sm:px-6 sm:pb-8 lg:px-8">
        <section className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <h1 className="ws-display text-3xl sm:text-4xl">
              {title}
            </h1>
            {description && (
              <p className="mt-3 max-w-xl text-base leading-7 text-[var(--ws-muted)] sm:text-lg">
                {description}
              </p>
            )}
          </div>

          {actions && <div className="flex items-center gap-3">{actions}</div>}
        </section>

        {children}
      </main>

      <nav className="fixed inset-x-4 bottom-4 z-30 mx-auto flex max-w-md items-center justify-between rounded-full border border-[var(--ws-line)] bg-[#fffdf8]/95 p-2 shadow-xl shadow-stone-300/50 backdrop-blur md:hidden">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === "/"}
            className={({ isActive }) =>
              isActive
                ? "flex-1 rounded-full bg-[var(--ws-orange)] px-3 py-3 text-center text-sm font-semibold !text-white"
                : "flex-1 rounded-full px-3 py-3 text-center text-sm font-medium text-[var(--ws-muted)] transition hover:text-[var(--ws-ink)]"
            }
          >
            {link.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
