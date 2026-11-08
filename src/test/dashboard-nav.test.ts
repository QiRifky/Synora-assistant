import { describe, expect, it } from "vitest";
import { NAV } from "@/routes/app";
import { DraftsNavIcon } from "@/components/ui/drafts-nav-icon";
import { CalendarNavIcon } from "@/components/ui/calendar-nav-icon";

describe("Dashboard sidebar destinations", () => {
  it("offers a Drafts menu that opens the drafts view", () => {
    const drafts = NAV.find((n) => n.id === "drafts");

    expect(drafts?.label).toBe("Drafts");
    expect(drafts?.icon).toBe(DraftsNavIcon);
    expect(NAV.find((n) => n.id === "calendar")?.icon).toBe(CalendarNavIcon);
    expect(NAV.map((n) => n.id)).toEqual(["overview", "channels", "posts", "drafts", "calendar", "ideas", "discover", "photo"]);
  });
});
