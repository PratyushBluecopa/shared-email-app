import * as React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { IconMailbox, IconSettings } from "@tabler/icons-react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { BluecopaLogo } from "~/components/bluecopa-logo";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "~/components/ui/sidebar";
import { ROUTES } from "~/constants";
import { cn } from "~/utils/utils";

type NavSection = {
  title: string;
  items: { label: string; href: string; icon: React.ReactNode }[];
};

const NAV_SECTIONS: NavSection[] = [
  {
    title: "Mail",
    items: [{ label: "Inbox", href: ROUTES.INBOX, icon: <IconMailbox className="copa:h-5 copa:w-5" /> }],
  },
  {
    title: "Management",
    items: [{ label: "Settings", href: ROUTES.SETTINGS, icon: <IconSettings className="copa:h-5 copa:w-5" /> }],
  },
];

// Mirrors the cash app's AppSidebar (app-sidebar.tsx + app-sidebar/nav-section.tsx).
export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { state, isMobile, setOpenMobile, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";

  // Close the mobile Sheet on any route change.
  React.useEffect(() => {
    if (isMobile) setOpenMobile(false);
  }, [location.pathname, isMobile, setOpenMobile]);

  const isActivePath = (href: string) =>
    location.pathname === href || location.pathname.startsWith(`${href}/`);

  return (
    <Sidebar
      variant="sidebar"
      collapsible="icon"
      className="copa:border-r"
      role="navigation"
      aria-label="Main navigation"
    >
      <SidebarHeader className="copa:h-16 copa:justify-center">
        <button
          type="button"
          onClick={() => navigate(ROUTES.INBOX)}
          aria-label="Shared Email home"
          className={cn(
            "copa:flex copa:items-center copa:gap-2 copa:overflow-hidden copa:cursor-pointer copa:rounded-md copa:hover:bg-muted/60 copa:transition-colors",
            isCollapsed ? "copa:justify-center copa:px-0" : "copa:justify-start copa:px-2",
          )}
        >
          <BluecopaLogo
            aria-hidden="true"
            className="copa:shrink-0"
            style={isCollapsed ? { height: 28, width: 28 } : { height: 36, width: 36 }}
          />
        </button>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            {NAV_SECTIONS.map((section) => (
              <div key={section.title} className="copa:mb-2" role="group" aria-label={section.title}>
                <div className="copa:px-2 copa:pb-1 copa:text-xs copa:font-medium copa:text-muted-foreground copa:group-data-[collapsible=icon]:hidden">
                  {section.title}
                </div>
                <SidebarMenu>
                  {section.items.map((item) => {
                    const isActive = isActivePath(item.href);
                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton
                          asChild
                          isActive={isActive}
                          className={
                            isActive
                              ? "copa:bg-primary/10! copa:text-primary! copa:font-semibold copa:relative copa:before:absolute copa:before:left-0 copa:before:top-1.5 copa:before:bottom-1.5 copa:before:w-0.5 copa:before:rounded-r copa:before:bg-primary"
                              : undefined
                          }
                        >
                          <Link to={item.href} className="copa:flex copa:items-center copa:gap-2">
                            <span aria-hidden="true">{item.icon}</span>
                            <span>{item.label}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </div>
            ))}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Chevron toggle on the sidebar's right border, centered on the header separator. */}
      {!isMobile && (
        <button
          type="button"
          onClick={toggleSidebar}
          className="copa:cursor-pointer copa:absolute copa:-right-3 copa:top-[52px] copa:z-20 copa:h-6 copa:w-6 copa:rounded-full copa:border copa:border-border copa:bg-background copa:shadow-sm copa:flex copa:items-center copa:justify-center copa:text-muted-foreground copa:hover:text-foreground copa:hover:bg-accent copa:transition-colors"
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={isCollapsed ? "Expand" : "Collapse"}
        >
          {isCollapsed ? <PanelLeftClose className="copa:h-3.5 copa:w-3.5" /> : <PanelLeftOpen className="copa:h-3.5 copa:w-3.5" />}
        </button>
      )}
    </Sidebar>
  );
}
