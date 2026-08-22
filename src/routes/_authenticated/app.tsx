import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import {
  BottomTabs,
  DesktopHeader,
  DesktopSidebar,
  TopBar,
  touristLinks,
} from "@/components/layout/nav";

export const Route = createFileRoute("/_authenticated/app")({
  component: TouristLayout,
});

const titles: Record<string, string> = {
  "/app": "Home",
  "/app/map": "Safety Map",
  "/app/id": "Digital ID",
  "/app/alerts": "My Alerts",
  "/app/profile": "Profile",
};

function TouristLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const title = titles[pathname] ?? "BEACON";

  return (
    <div className="min-h-screen">
      <TopBar title={title} links={touristLinks} />
      <div className="mx-auto flex w-full max-w-6xl gap-6 px-4 py-6 lg:px-6">
        <DesktopSidebar links={touristLinks} subtitle="Tourist" />
        <main className="min-w-0 flex-1 pb-28 lg:pb-6">
          <DesktopHeader title={title} />
          <Outlet />
        </main>
      </div>
      <BottomTabs />
    </div>
  );
}
