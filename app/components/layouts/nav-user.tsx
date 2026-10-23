import { IconDotsVertical, IconLogout } from "@tabler/icons-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { useAppContext } from "~/contexts/app-context";

// Mirrors the cash app's NavUser (header user pill + dropdown).
export function NavUser() {
  const { user, isLoading } = useAppContext();
  const name = user?.name;
  const email = user?.email ?? undefined;
  const displayName = name || email || "";

  if (isLoading) {
    return (
      <div className="copa:animate-pulse copa:p-2" role="status" aria-label="Loading user menu">
        <div className="copa:h-8 copa:w-8 copa:rounded-md copa:bg-muted copa:mb-2" />
        <div className="copa:grid copa:flex-1 copa:text-left copa:text-sm copa:leading-tight">
          <div className="copa:h-4 copa:w-20 copa:bg-muted copa:rounded copa:mb-1" />
          <div className="copa:h-3 copa:w-32 copa:bg-muted copa:rounded" />
        </div>
      </div>
    );
  }

  const initial = ((displayName || "?").trim().charAt(0) || "?").toUpperCase();

  return (
    <div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`User menu for ${name || email || "user"}`}
            className="copa:flex copa:items-center copa:gap-2 copa:border copa:border-border copa:rounded-md copa:px-2 copa:py-1.5 copa:cursor-pointer copa:hover:bg-accent/50 copa:transition-colors copa:max-w-[220px]"
            title={email || name || undefined}
          >
            <span
              className="copa:flex copa:h-7 copa:w-7 copa:shrink-0 copa:items-center copa:justify-center copa:rounded-full copa:bg-primary copa:text-white copa:text-xs copa:font-semibold"
              aria-hidden="true"
            >
              {initial}
            </span>
            <div className="copa:hidden copa:sm:flex copa:flex-col copa:items-start copa:min-w-0 copa:leading-tight">
              <span className="copa:truncate copa:text-sm copa:font-medium copa:max-w-[140px]">{displayName}</span>
            </div>
            <IconDotsVertical className="copa:ml-auto copa:size-4 copa:shrink-0 copa:text-muted-foreground" aria-hidden="true" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="copa:w-56 copa:rounded-md" side="right" align="start" sideOffset={8}>
          <DropdownMenuLabel className="copa:p-0 copa:font-normal">
            <div className="copa:flex copa:items-center copa:gap-2 copa:px-1 copa:py-1.5 copa:text-left copa:text-sm">
              <div className="copa:grid copa:flex-1 copa:text-left copa:text-sm copa:leading-tight">
                <span className="copa:truncate copa:font-medium">{displayName}</span>
                <span className="copa:text-muted-foreground copa:truncate copa:text-xs">{email}</span>
              </div>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="copa:cursor-pointer"
            onClick={() => {
              window.location.href = "/authz/logout";
            }}
          >
            <IconLogout aria-hidden="true" />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
