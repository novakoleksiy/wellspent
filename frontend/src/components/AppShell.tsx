import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

type AppShellProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
};

const links = [
  { to: "/recommend", label: "Plan a Trip" },
  { to: "/trips", label: "My Trips" },
  { to: "/settings", label: "Settings" },
];

function navClass(isActive: boolean): string {
  return isActive
    ? "rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-900 shadow-sm"
    : "rounded-full px-4 py-2 text-sm font-medium text-slate-500 transition hover:bg-white/70 hover:text-slate-900";
}

export default function AppShell({
  title,
  description,
  actions,
  children,
}: AppShellProps) {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(254,226,226,0.75),_transparent_32%),linear-gradient(180deg,#fcfbf8_0%,#f8f5ef_100%)] text-slate-900">
      <header className="sticky top-0 z-20 border-b border-white/70 bg-[#fcfbf8]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="flex items-center gap-4">
            <NavLink to="/trips" className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-sm font-semibold text-white shadow-lg shadow-slate-900/15">
                WS
              </div>
              <div>
                <p className="text-sm font-semibold tracking-[0.18em] text-slate-500 uppercase">
                  WellSpent
                </p>
                <p className="text-sm text-slate-500">Smart trip planning for Swiss escapes</p>
              </div>
            </NavLink>

            <nav className="hidden items-center gap-2 rounded-full bg-white/70 p-1 shadow-sm ring-1 ring-slate-200/70 md:flex">
              {links.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className={({ isActive }) => navClass(isActive)}
                >
                  {link.label}
                </NavLink>
              ))}
            </nav>
          </div>

          <div className="flex items-center justify-between gap-3 md:justify-end">
            <nav className="flex items-center gap-2 rounded-full bg-white/70 p-1 shadow-sm ring-1 ring-slate-200/70 md:hidden">
              {links.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className={({ isActive }) => navClass(isActive)}
                >
                  {link.label}
                </NavLink>
              ))}
            </nav>

            <div className="hidden rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-right shadow-sm sm:block">
              <p className="text-sm font-medium text-slate-900">{user?.full_name}</p>
              <p className="text-xs text-slate-500">{user?.email}</p>
            </div>

            <button
              onClick={logout}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="mb-3 text-xs font-semibold tracking-[0.28em] text-slate-500 uppercase">
              Swiss travel planner
            </p>
            <h1 className="text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
              {title}
            </h1>
            {description && (
              <p className="mt-3 max-w-xl text-base leading-7 text-slate-600 sm:text-lg">
                {description}
              </p>
            )}
          </div>

          {actions && <div className="flex items-center gap-3">{actions}</div>}
        </section>

        {children}
      </main>
    </div>
  );
}
