import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LayoutDashboard, Radio } from "lucide-react";
import { SidebarNav } from "@/components/ui/dashboard-sidebar";

const closeMobile = vi.hoisted(() => vi.fn());
vi.mock("@/components/ui/sidebar", async () => {
  const React = await import("react");
  const wrapper = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return {
    Sidebar: wrapper, SidebarContent: wrapper, SidebarFooter: wrapper,
    SidebarGroup: wrapper, SidebarGroupContent: wrapper, SidebarGroupLabel: wrapper,
    SidebarHeader: wrapper, SidebarMenu: wrapper, SidebarMenuItem: wrapper,
    SidebarMenuButton: wrapper,
    useSidebar: () => ({ setOpenMobile: closeMobile }),
  };
});

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("Dashboard sidebar actions", () => {
  function setup() {
    const onSelect = vi.fn();
    const onSignOut = vi.fn();
    render(<SidebarNav
      groups={[{ items: [
        { id: "overview", title: "Overview", icon: LayoutDashboard },
        { id: "channels", title: "Channels", icon: Radio },
      ] }]}
      activeId="overview" settingsId="settings" email="no email provided"
      onSelect={onSelect} onSignOut={onSignOut}
    />);
    return { onSelect, onSignOut };
  }

  it("selects the existing channel view and closes the mobile drawer", () => {
    const { onSelect } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Channels" }));
    expect(onSelect).toHaveBeenCalledExactlyOnceWith("channels");
    expect(closeMobile).toHaveBeenCalledExactlyOnceWith(false);
  });

  it("uses the existing settings destination", () => {
    const { onSelect } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(onSelect).toHaveBeenCalledExactlyOnceWith("settings");
  });

  it("shows the animated gear icon on the Settings item", () => {
    setup();
    const button = screen.getByRole("button", { name: "Settings" });
    expect(button.querySelector('path[d^="M21.011"]')).not.toBeNull();
  });

  it("calls the supplied sign-out action once", () => {
    const { onSignOut, onSelect } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(onSignOut).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });
});