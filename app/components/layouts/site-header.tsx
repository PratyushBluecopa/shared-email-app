import { IconChevronDown, IconInbox, IconMail, IconSettings } from "@tabler/icons-react";
import { NavLink } from "react-router-dom";

import { BluecopaLogo } from "~/components/bluecopa-logo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { ROUTES } from "~/constants";
import { useAppContext } from "~/contexts/app-context";
import { cn } from "~/utils/utils";

const NAV_ITEMS = [
  { label: "Inbox", to: ROUTES.INBOX, icon: IconInbox },
  { label: "Settings", to: ROUTES.SETTINGS, icon: IconSettings },
];

function UserInitials({ name }: { name?: string }) {
  const initials = (name ?? "")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <span className="copa:flex copa:size-7 copa:shrink-0 copa:items-center copa:justify-center copa:rounded-full copa:bg-primary/10 copa:text-xs copa:font-semibold copa:text-primary">
      {initials || "?"}
    </span>
  );
}

export function SiteHeader() {
  const { user, emailAccount } = useAppContext();

  return (
    <header className="copa:flex copa:h-14 copa:shrink-0 copa:items-center copa:gap-6 copa:border-b copa:border-border copa:bg-background copa:px-4">
      <div className="copa:flex copa:items-center copa:gap-2">
        <BluecopaLogo className="copa:size-7" />
        <span className="copa:text-sm copa:font-semibold">Shared Email</span>
      </div>

      <nav className="copa:flex copa:h-full copa:items-stretch copa:gap-1" aria-label="Main">
        {NAV_ITEMS.map(({ label, to, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                "copa:flex copa:items-center copa:gap-1.5 copa:border-b-2 copa:px-3 copa:text-sm copa:font-medium copa:transition-colors",
                isActive
                  ? "copa:border-primary copa:text-primary"
                  : "copa:border-transparent copa:text-muted-foreground copa:hover:text-foreground",
              )
            }
          >
            <Icon className="copa:size-4" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="copa:ml-auto copa:flex copa:items-center copa:gap-3">
        {emailAccount?.email && (
          <span
            className="copa:hidden copa:md:flex copa:items-center copa:gap-1.5 copa:rounded-full copa:bg-muted copa:px-3 copa:py-1 copa:text-xs copa:text-muted-foreground"
            title="Shared mailbox"
          >
            <IconMail className="copa:size-3.5" />
            {emailAccount.email}
          </span>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="copa:flex copa:items-center copa:gap-2 copa:rounded-full copa:py-1 copa:pl-1 copa:pr-2 copa:text-sm copa:transition-colors copa:hover:bg-accent copa:focus-visible:outline-none copa:focus-visible:ring-2 copa:focus-visible:ring-ring"
              aria-label="Account"
            >
              <UserInitials name={user?.name} />
              <span className="copa:hidden copa:sm:inline copa:font-medium">{user?.name}</span>
              <IconChevronDown className="copa:size-3.5 copa:text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={8} className="copa:w-60 copa:rounded-lg copa:p-1.5 copa:shadow-lg">
            <DropdownMenuLabel className="copa:px-2 copa:py-2 copa:font-normal">
              <div className="copa:flex copa:items-center copa:gap-2.5">
                <UserInitials name={user?.name} />
                <div className="copa:min-w-0 copa:flex copa:flex-col">
                  <span className="copa:truncate copa:text-sm copa:font-medium">{user?.name}</span>
                  <span className="copa:truncate copa:text-xs copa:text-muted-foreground">{user?.email}</span>
                </div>
              </div>
            </DropdownMenuLabel>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
