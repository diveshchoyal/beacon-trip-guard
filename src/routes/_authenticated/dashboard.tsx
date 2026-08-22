import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { DesktopHeader, DesktopSidebar, TopBar, policeLinks } from "@/components/layout/nav";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardLayout,
});

const titles: Record<string, string> = {
  "/dashboard": "Live Map",
  "/dashboard/alerts": "Incoming Alerts",
  "/dashboard/registry": "Tourist Registry",
  "/dashboard/efir": "E-FIR Log",
};

function DashboardLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const title = titles[pathname] ?? "Command Centre";

  return (
    <div className="min-h-screen">
      <TopBar title={title} links={policeLinks} />
      <div className="mx-auto flex w-full max-w-7xl gap-6 px-4 py-6 lg:px-6">
        <DesktopSidebar links={policeLinks} subtitle="Command Centre" />
        <main className="min-w-0 flex-1 pb-10">
          <DesktopHeader title={title} />
          <Outlet />
        </main>
      </div>
    </div>
  );
}
