import { cn } from "~/utils/utils";

// A single shimmering placeholder block (cash app's skeleton Bar).
function Bar({ className }: { className?: string }) {
  return <div className={cn("copa:skeleton-shimmer copa:rounded-md copa:bg-muted/70 copa:dark:bg-muted/40", className)} />;
}

/** Full-page loading placeholder mirroring the three-pane inbox layout. */
export function InboxSkeleton() {
  return (
    <div className="copa:flex copa:h-full copa:overflow-hidden copa:bg-background" aria-busy="true" aria-label="Loading inbox">
      <div className="copa:hidden copa:sm:flex copa:w-56 copa:shrink-0 copa:flex-col copa:gap-4 copa:border-r copa:bg-muted/30 copa:p-3">
        <Bar className="copa:h-10 copa:w-full" />
        <div className="copa:space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Bar key={i} className="copa:h-9 copa:w-full" />
          ))}
        </div>
      </div>

      <div className="copa:flex copa:w-full copa:flex-col copa:border-r copa:lg:w-[420px] copa:lg:min-w-[360px]">
        <div className="copa:flex copa:items-center copa:gap-2 copa:border-b copa:p-3">
          <Bar className="copa:h-9 copa:flex-1" />
          <Bar className="copa:h-9 copa:w-9 copa:shrink-0" />
        </div>
        <div className="copa:flex-1 copa:divide-y copa:divide-border/50 copa:overflow-hidden">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="copa:px-4 copa:py-3 copa:space-y-2">
              <div className="copa:flex copa:items-center copa:justify-between copa:gap-2">
                <Bar className="copa:h-3.5 copa:w-40" />
                <Bar className="copa:h-3 copa:w-16" />
              </div>
              <div className="copa:flex copa:items-center copa:gap-2">
                <Bar className="copa:h-3.5 copa:flex-1 copa:max-w-[200px]" />
              </div>
              <Bar className="copa:h-3 copa:w-3/4" />
            </div>
          ))}
        </div>
      </div>

      <div className="copa:hidden copa:flex-1 copa:flex-col copa:items-center copa:justify-center copa:gap-3 copa:lg:flex">
        <Bar className="copa:h-12 copa:w-12 copa:rounded-lg" />
        <Bar className="copa:h-3 copa:w-48" />
      </div>
    </div>
  );
}
