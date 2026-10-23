import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";

import { AppSidebar } from "~/components/layouts/app-sidebar";
import { SiteHeader } from "~/components/layouts/site-header";
import { SidebarInset, SidebarProvider } from "~/components/ui/sidebar";

// Same sizes as the cash app (calc(var(--spacing) * 72 / 12)); literal because
// the copa prefix renames Tailwind's --spacing variable.
const SIDEBAR_STYLE = {
  "--sidebar-width": "18rem",
  "--header-height": "3rem",
} as React.CSSProperties;

// Auto-collapse the main sidebar below xl (1280px), like the cash app.
const COMPACT_QUERY = "(max-width: 1279px)";

// Mirrors the cash app's AppLayout: collapsible app sidebar + header, content padded px-6 py-4.
export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(() =>
    typeof window === "undefined" ? true : !window.matchMedia(COMPACT_QUERY).matches,
  );

  useEffect(() => {
    const mq = window.matchMedia(COMPACT_QUERY);
    const handler = (e: MediaQueryListEvent) => setSidebarOpen(!e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return (
    <SidebarProvider style={SIDEBAR_STYLE} open={sidebarOpen} onOpenChange={setSidebarOpen}>
      <a
        href="#main-content"
        className="copa:sr-only copa:focus:not-sr-only copa:focus:absolute copa:focus:z-50 copa:focus:p-4 copa:focus:bg-background copa:focus:text-foreground"
      >
        Skip to main content
      </a>
      <AppSidebar />
      <SidebarInset id="main-content" className="copa:min-w-0 copa:overflow-hidden">
        <SiteHeader />
        <div className="copa:h-full copa:min-w-0 copa:overflow-y-auto copa:overflow-x-hidden copa:flex copa:flex-1 copa:flex-col copa:px-6 copa:py-4">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
