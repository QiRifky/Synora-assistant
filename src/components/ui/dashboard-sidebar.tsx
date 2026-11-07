import type { ElementType, ReactNode } from "react";
import { LogOut, Settings, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SynoraLogo } from "@/components/synora-logo";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup,
  SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu,
  SidebarMenuButton, SidebarMenuItem, useSidebar,
} from "@/components/ui/sidebar";

export type NavItemData<T extends string = string> = {
  id: T;
  title: string;
  icon: ElementType;
  badge?: number | string;
};

export type NavGroupData<T extends string = string> = {
  heading?: string;
  items: NavItemData<T>[];
};

/** Adapted from the supplied sidebar; navigation and account data come from Synora. */
export function SidebarNav<T extends string>({
  groups, activeId, onSelect, settingsId, email, onSignOut,
}: {
  groups: NavGroupData<T>[];
  activeId: T;
  onSelect: (id: T) => void;
  settingsId: T;
  email: string;
  onSignOut: () => void;
}) {
  const { setOpenMobile } = useSidebar();

  function select(id: T) {
    onSelect(id);
    setOpenMobile(false);
  }

  function item(id: T, title: string, icon: ElementType, badge?: ReactNode) {
    const Icon = icon;
    return (
      <SidebarMenuItem key={id}>
        <SidebarMenuButton
          asChild
          isActive={activeId === id}
          className="h-9 gap-2.5 rounded-md px-2.5 text-[13px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground data-[active=true]:bg-muted data-[active=true]:text-foreground motion-reduce:transition-none"
        >
          <Button variant="ghost" aria-current={activeId === id ? "page" : undefined} onClick={() => select(id)}>
            <Icon strokeWidth={1.5} />
            <span className="flex-1 truncate text-left">{title}</span>
            {badge !== undefined && <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-md bg-primary/10 px-1.5 text-[10px] text-primary">{badge}</span>}
          </Button>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  return (
    <Sidebar className="border-r border-border [&>[data-sidebar=sidebar]]:bg-card [&>[data-sidebar=sidebar]]:text-card-foreground motion-reduce:transition-none">
      <SidebarHeader className="bg-card px-5 py-5">
        <div className="flex min-h-6 items-center justify-between gap-3">
          <SynoraLogo className="self-start" />
          <Button variant="ghost" size="icon" className="h-7 w-7 md:hidden" aria-label="Close navigation" onClick={() => setOpenMobile(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </SidebarHeader>
      <SidebarContent className="gap-4 bg-card px-3">
        <nav aria-label="Dashboard navigation">
          {groups.map((group, index) => (
            <SidebarGroup key={group.heading ?? index} className="px-0">
              {group.heading && <SidebarGroupLabel className="h-7 px-2.5 text-[11px] text-muted-foreground">{group.heading}</SidebarGroupLabel>}
              <SidebarGroupContent>
                <SidebarMenu className="gap-0.5">
                  {group.items.map((entry) => item(entry.id, entry.title, entry.icon, entry.badge))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </nav>
      </SidebarContent>
      <SidebarFooter className="gap-3 border-t border-border bg-card p-3">
        <SidebarMenu className="gap-0.5">
          {item(settingsId, "Settings", Settings)}
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="h-9 gap-2.5 rounded-md px-2.5 text-[13px] text-muted-foreground hover:bg-muted hover:text-foreground">
              <Button variant="ghost" onClick={onSignOut}>
                <LogOut strokeWidth={1.5} /> <span className="text-left">Sign out</span>
              </Button>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <p className="truncate px-2.5 pb-1 text-xs text-muted-foreground" title={email}>{email}</p>
      </SidebarFooter>
    </Sidebar>
  );
}