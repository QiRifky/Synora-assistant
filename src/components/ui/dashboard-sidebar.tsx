import { useState, type ElementType, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";

/** Forward row hover to the animated icon so text and padding trigger it too. */
function hoverIcon(e: ReactMouseEvent<HTMLElement>, type: "mouseover" | "mouseout") {
  const icon = e.currentTarget.querySelector<HTMLElement>("[data-nav-icon] > *");
  icon?.dispatchEvent(new MouseEvent(type, { bubbles: true, relatedTarget: e.currentTarget }));
}
const rowHover = {
  onMouseEnter: (e: ReactMouseEvent<HTMLElement>) => hoverIcon(e, "mouseover"),
  onMouseLeave: (e: ReactMouseEvent<HTMLElement>) => hoverIcon(e, "mouseout"),
};
import { ArrowUpRight, ChevronRight, LogOut, X } from "lucide-react";
import { SettingsNavIcon } from "@/components/ui/settings-nav-icon";
import { Button } from "@/components/ui/button";
import { SynoraLogo } from "@/components/synora-logo";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup,
  SidebarGroupContent, SidebarHeader, SidebarMenu,
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
  icon?: ElementType;
  items: NavItemData<T>[];
};

/** Workspace-style sidebar: top-level items plus collapsible folders, account block at the bottom. */
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
  const [closed, setClosed] = useState<Record<string, boolean>>({});

  function select(id: T) {
    onSelect(id);
    setOpenMobile(false);
  }

  function item(id: T, title: string, icon: ElementType, badge?: ReactNode, nested = false) {
    const Icon = icon;
    const active = activeId === id;
    return (
      <SidebarMenuItem key={id}>
        <SidebarMenuButton
          asChild
          isActive={active}
          className={`h-8 gap-2 rounded-md px-2 text-[13px] text-foreground transition-colors hover:bg-muted data-[active=true]:bg-muted data-[active=true]:font-medium motion-reduce:transition-none ${nested ? "pl-7" : ""}`}
        >
          <Button variant="ghost" aria-current={active ? "page" : undefined} onClick={() => select(id)} {...rowHover}>
            <span data-nav-icon className="pointer-events-none inline-flex"><Icon strokeWidth={1.5} className="size-3.5 text-muted-foreground" /></span>
            <span className="flex-1 truncate text-left">{title}</span>
            {badge !== undefined && <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-md bg-primary/10 px-1.5 text-[10px] text-primary">{badge}</span>}
          </Button>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  return (
    <Sidebar className="border-r border-border [&>[data-sidebar=sidebar]]:bg-card [&>[data-sidebar=sidebar]]:text-card-foreground motion-reduce:transition-none">
      <SidebarHeader className="bg-card px-5 pb-3 pt-6">
        <div className="flex min-h-6 items-center justify-between gap-3">
          <SynoraLogo className="self-start opacity-70" />
          <Button variant="ghost" size="icon" className="h-7 w-7 md:hidden" aria-label="Close navigation" onClick={() => setOpenMobile(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </SidebarHeader>
      <SidebarContent className="bg-card px-3">
        <nav aria-label="Dashboard navigation">
          {groups.map((group, index) => {
            const key = group.heading ?? String(index);
            if (!group.heading) {
              return (
                <SidebarGroup key={key} className="px-0 py-0.5">
                  <SidebarGroupContent><SidebarMenu className="gap-0.5">{group.items.map((e) => item(e.id, e.title, e.icon, e.badge))}</SidebarMenu></SidebarGroupContent>
                </SidebarGroup>
              );
            }
            const FolderIcon = group.icon;
            const hasActive = group.items.some((e) => e.id === activeId);
            const open = hasActive || !closed[key];
            return (
              <SidebarGroup key={key} className="px-0 py-0.5">
                <Button
                  variant="ghost"
                  aria-expanded={open}
                  onClick={() => setClosed((c) => ({ ...c, [key]: open }))}
                  {...rowHover}
                  className="h-8 w-full justify-start gap-2 rounded-md px-2 text-[13px] font-medium text-foreground hover:bg-muted"
                >
                  {FolderIcon && <span data-nav-icon className="pointer-events-none inline-flex"><FolderIcon strokeWidth={1.5} className="size-3.5 text-muted-foreground" /></span>}
                  <span className={`flex-1 text-left ${hasActive ? "font-semibold" : ""}`}>{group.heading}</span>
                  <ChevronRight aria-hidden="true" className={`size-3.5 text-muted-foreground transition-transform motion-reduce:transition-none ${open ? "rotate-90" : ""}`} />
                </Button>
                {open && (
                  <SidebarGroupContent className="pt-0.5">
                    <SidebarMenu className="gap-0.5">{group.items.map((e) => item(e.id, e.title, e.icon, e.badge, true))}</SidebarMenu>
                  </SidebarGroupContent>
                )}
              </SidebarGroup>
            );
          })}
        </nav>
      </SidebarContent>
      <SidebarFooter className="gap-2 border-t border-border bg-card p-3">
        <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
          <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold uppercase text-primary">{email.charAt(0) || "S"}</span>
          <div className="min-w-0">
            <p className="text-[11px] text-muted-foreground">Buffer account</p>
            <p className="truncate text-xs text-foreground" title={email}>{email}</p>
          </div>
        </div>
        <SidebarMenu className="gap-0.5">
          {item(settingsId, "Settings", SettingsNavIcon)}
        </SidebarMenu>
        <a href="/" className="flex items-center gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground">Synora home<ArrowUpRight className="size-3" /></a>
        <SidebarMenu className="gap-0.5">
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="h-8 gap-2 rounded-md px-2 text-[13px] text-muted-foreground hover:bg-muted hover:text-foreground">
              <Button variant="ghost" onClick={onSignOut}>
                <LogOut strokeWidth={1.5} className="size-3.5" /> <span className="text-left">Sign out</span>
              </Button>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
