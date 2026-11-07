import { describe, expect, it } from "vitest";
import { NAV } from "@/routes/app";

describe("Dashboard sidebar destinations", () => {
  it("offers a Drafts menu that opens the drafts view", () => {
    const drafts = NAV.find((n) => n.id === "drafts");

    expect(drafts?.label).toBe("Drafts");
    expect(NAV.map((n) => n.id)).toEqual(["overview", "channels", "posts", "drafts", "calendar", "ideas", "discover", "photo"]);
  });
});
