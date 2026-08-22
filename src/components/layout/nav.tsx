import { useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  FileText,
  Fingerprint,
  Home,
  LogOut,
  Map,
  Menu,
  Users,
  UserRound,
  X,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import logo from "@/assets/beacon-logo.png";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export type NavLink = {
  to: string;
  label: string;
  icon: typeof Home;
  exact?: boolean;
};

export const touristLinks: NavLink[] = [
  { to: "/app", label: "Home", icon: Home, exact: true },
  { to: "/app/map", label: "Map", icon: Map },
  { to: "/app/id", label: "Digital ID", icon: Fingerprint },
  { to: "/app/alerts", label: "Alerts", icon: AlertTriangle },
  { to: "/app/profile", label: "Profile", icon: UserRound },
];

export const policeLinks: NavLink[] = [
  { to: "/dashboard", label: "Live Map", icon: Map, exact: true },
  { to: "/dashboard/alerts", label: "Alerts", icon: AlertTriangle },
  { to: "/dashboard/registry", label: "Tourist Registry", icon: Users },
  { to: "/dashboard/efir", label: "E-FIR Log", icon: FileText },
];

export function useSignOut() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  return async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  };
}

function useActive() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (to: string, exact?: boolean) => (exact ? pathname === to : pathname.startsWith(to));
}

export function TopBar({
  title,
  links,
}: {
  title: string;
  links: NavLink[];
}) {
  const [open, setOpen] = useState(false);
  const isActive = useActive();
  const signOut = useSignOut();

  return (
    <>
      <header className="sticky top-0 z-30 px-4 pt-4 lg:hidden">
        <div className="glass grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-3 py-2.5">
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setOpen(true)}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-foreground active:scale-90"
          >
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="truncate text-center text-base font-semibold text-foreground">{title}</h1>
          <span className="h-10 w-10" />
        </div>
      </header>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-40 bg-black/40 lg:hidden"
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 34 }}
              className="glass fixed inset-y-0 left-0 z-50 flex w-[82%] max-w-xs flex-col rounded-l-none p-5 lg:hidden"
            >
              <div className="flex items-center justify-between">
                <div className="flex min-w-0 items-center gap-2">
                  <img src={logo} alt="" width={1024} height={1024} className="h-9 w-9 shrink-0 object-contain" />
                  <span className="truncate text-sm font-semibold tracking-[0.25em]">BEACON</span>
                </div>
                <button
                  aria-label="Close menu"
                  onClick={() => setOpen(false)}
                  className="grid h-9 w-9 place-items-center rounded-full text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <nav className="mt-7 flex flex-1 flex-col gap-1.5">
                {links.map((l) => (
                  <Link
                    key={l.to}
                    to={l.to}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-colors",
                      isActive(l.to, l.exact)
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent/60",
                    )}
                  >
                    <l.icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{l.label}</span>
                  </Link>
                ))}
              </nav>

              <button
                onClick={signOut}
                className="mt-4 flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-muted-foreground hover:bg-accent/60"
              >
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

export function BottomTabs() {
  const isActive = useActive();
  const tabs = touristLinks.slice(0, 4);
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 px-4 pb-4 lg:hidden">
      <div className="glass grid grid-cols-4 gap-1 p-1.5">
        {tabs.map((t) => {
          const active = isActive(t.to, t.exact);
          return (
            <Link
              key={t.to}
              to={t.to}
              className="relative flex flex-col items-center gap-1 rounded-2xl px-1 py-2 text-[10px] font-semibold"
            >
              {active && (
                <motion.span
                  layoutId="tab-pill"
                  className="absolute inset-0 rounded-2xl bg-primary"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <t.icon
                className={cn(
                  "relative h-4.5 w-4.5",
                  active ? "text-primary-foreground" : "text-muted-foreground",
                )}
              />
              <span className={cn("relative", active ? "text-primary-foreground" : "text-muted-foreground")}>
                {t.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function DesktopSidebar({
  links,
  subtitle,
}: {
  links: NavLink[];
  subtitle: string;
}) {
  const isActive = useActive();
  const signOut = useSignOut();

  return (
    <aside className="glass sticky top-6 hidden h-[calc(100vh-3rem)] w-64 shrink-0 flex-col p-5 lg:flex">
      <div className="flex min-w-0 items-center gap-3">
        <img src={logo} alt="" width={1024} height={1024} className="h-10 w-10 shrink-0 object-contain" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold tracking-[0.25em]">BEACON</p>
          <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>

      <nav className="mt-8 flex flex-1 flex-col gap-1.5">
        {links.map((l) => (
          <Link
            key={l.to}
            to={l.to}
            className={cn(
              "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-colors",
              isActive(l.to, l.exact)
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent/60",
            )}
          >
            <l.icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{l.label}</span>
          </Link>
        ))}
      </nav>

      <button
        onClick={signOut}
        className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-muted-foreground hover:bg-accent/60"
      >
        <LogOut className="h-4 w-4" /> Sign out
      </button>
    </aside>
  );
}

export function DesktopHeader({ title }: { title: string }) {
  return (
    <div className="glass mb-6 hidden items-center justify-between px-5 py-3 lg:flex">
      <h1 className="truncate text-lg font-semibold text-foreground">{title}</h1>
    </div>
  );
}
