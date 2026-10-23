import { NavUser } from "~/components/layouts/nav-user";

// Mirrors the cash app's AppHeader (app.header.tsx) minus the cash-only command
// palette hint, last-refreshed pill and notifications.
export function SiteHeader({ title = "Shared Email" }: { title?: string }) {
  return (
    <header className="copa:flex copa:h-16 copa:shrink-0 copa:items-center copa:gap-2 copa:border-b copa:bg-background/80 copa:backdrop-blur copa:supports-backdrop-filter:bg-background/60 copa:transition-[width,height] copa:ease-linear">
      <div className="copa:flex copa:flex-1 copa:min-w-0 copa:items-center copa:gap-2 copa:px-4 copa:lg:gap-3 copa:lg:px-6">
        <h1 className="copa:text-h5 copa:font-medium copa:text-foreground copa:tracking-tight copa:truncate">{title}</h1>
      </div>
      <div className="copa:flex copa:shrink-0 copa:items-center copa:gap-2 copa:px-4 copa:lg:gap-3 copa:lg:px-6">
        <NavUser />
      </div>
    </header>
  );
}
