import { Outlet } from "react-router-dom";
import { SiteHeader } from "~/components/layouts/site-header";

export function AppLayout() {
  return (
    <div className="copa:flex copa:h-svh copa:flex-col copa:bg-background copa:text-foreground">
      <SiteHeader />
      <main className="copa:flex-1 copa:min-h-0 copa:overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
