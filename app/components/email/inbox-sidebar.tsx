import { useEffect, useState } from "react";
import { PanelLeftClose, PanelLeftOpen, Mail, Send, Archive, Plus } from "lucide-react";

import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";
import { cn } from "~/utils/utils";

export type InboxFolder = "inbox" | "sent" | "drafts";

const COMPACT_QUERY = "(max-width: 1279px)";

interface InboxSidebarProps {
  activeFolder: InboxFolder;
  onFolderChange: (folder: InboxFolder) => void;
  inboxCount: number;
  sentCount: number;
  draftsCount: number;
  onCompose: () => void;
}

export function getFolders(counts: { inboxCount: number; sentCount: number; draftsCount: number }) {
  return [
    { id: "inbox" as const, label: "Inbox", icon: Mail, count: counts.inboxCount },
    { id: "sent" as const, label: "Sent", icon: Send, count: counts.sentCount },
    { id: "drafts" as const, label: "Drafts", icon: Archive, count: counts.draftsCount },
  ];
}

export default function InboxSidebar({ activeFolder, onFolderChange, onCompose, ...counts }: InboxSidebarProps) {
  // Auto-collapse below xl; the user can still toggle, and resizing snaps back.
  const [collapsed, setCollapsed] = useState(() =>
    typeof window === "undefined" ? false : window.matchMedia(COMPACT_QUERY).matches,
  );

  useEffect(() => {
    const mq = window.matchMedia(COMPACT_QUERY);
    const handler = (e: MediaQueryListEvent) => setCollapsed(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const folders = getFolders(counts);

  return (
    <div
      className={cn(
        "copa:relative copa:border-r copa:bg-muted/30 copa:h-full copa:transition-[width] copa:duration-200 copa:ease-out",
        "copa:hidden copa:sm:flex copa:sm:flex-col",
        collapsed ? "copa:w-12" : "copa:w-56",
      )}
    >
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="copa:cursor-pointer copa:absolute copa:-right-3 copa:top-5 copa:z-20 copa:h-6 copa:w-6 copa:rounded-full copa:border copa:border-border copa:bg-background copa:shadow-sm copa:flex copa:items-center copa:justify-center copa:text-muted-foreground copa:hover:text-foreground copa:hover:bg-accent copa:transition-colors"
        aria-label={collapsed ? "Expand inbox sidebar" : "Collapse inbox sidebar"}
        title={collapsed ? "Expand" : "Collapse"}
      >
        {collapsed ? <PanelLeftOpen className="copa:h-3.5 copa:w-3.5" /> : <PanelLeftClose className="copa:h-3.5 copa:w-3.5" />}
      </button>

      <div className={cn(collapsed ? "copa:px-2 copa:pt-3 copa:pb-1 copa:flex copa:justify-center" : "copa:px-3 copa:pt-3 copa:pb-2")}>
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onCompose}
                className="copa:h-8 copa:w-8 copa:rounded-md copa:bg-primary copa:text-white copa:flex copa:items-center copa:justify-center copa:hover:bg-primary/90 copa:transition-colors copa:shadow-sm"
                aria-label="Compose"
              >
                <Plus className="copa:h-4 copa:w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Compose</TooltipContent>
          </Tooltip>
        ) : (
          <Button onClick={onCompose} size="sm" className="copa:w-full copa:gap-1.5 copa:font-medium copa:h-8 copa:text-xs">
            <Plus className="copa:h-3.5 copa:w-3.5" />
            Compose
          </Button>
        )}
      </div>

      <nav className={cn("copa:flex-1 copa:py-2 copa:overflow-y-auto", collapsed ? "copa:px-1 copa:space-y-0.5 copa:flex copa:flex-col copa:items-center" : "copa:px-2 copa:space-y-1")}>
        {folders.map(({ id, label, icon: Icon, count }) => {
          const active = activeFolder === id;
          return collapsed ? (
            <Tooltip key={id}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onFolderChange(id)}
                  className={cn(
                    "copa:relative copa:flex copa:items-center copa:justify-center copa:h-8 copa:w-8 copa:rounded-md copa:transition-colors",
                    active ? "copa:bg-primary/10 copa:text-primary" : "copa:text-muted-foreground copa:hover:text-foreground copa:hover:bg-muted",
                  )}
                  aria-label={label}
                >
                  <Icon className="copa:h-4 copa:w-4" />
                  {count > 0 && (
                    <span className="copa:absolute copa:-top-1 copa:-right-1 copa:min-w-[14px] copa:h-[14px] copa:px-1 copa:rounded-full copa:text-[8px] copa:font-semibold copa:leading-none copa:flex copa:items-center copa:justify-center copa:ring-1 copa:ring-background copa:bg-primary copa:text-white">
                      {count > 99 ? "99+" : count}
                    </span>
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">{label}</TooltipContent>
            </Tooltip>
          ) : (
            <Button
              key={id}
              variant="ghost"
              size="sm"
              onClick={() => onFolderChange(id)}
              className={cn(
                "copa:w-full copa:justify-between copa:rounded-md copa:font-normal",
                active && "copa:ring-1 copa:ring-primary copa:bg-primary/10 copa:text-primary",
              )}
            >
              <span className="copa:flex copa:items-center copa:gap-2">
                <Icon className="copa:h-4 copa:w-4" />
                {label}
              </span>
              {count > 0 && (
                <Badge variant={active ? "secondary" : "outline"} className="copa:text-xs">
                  {count}
                </Badge>
              )}
            </Button>
          );
        })}
      </nav>
    </div>
  );
}
