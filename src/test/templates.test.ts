import { describe, expect, it } from "vitest";
import { CATEGORIES, TEMPLATES, fillCaption, parseFields } from "@/lib/templates";

describe("template library data", () => {
  it("has exactly 30 templates", () => {
    expect(TEMPLATES).toHaveLength(30);
  });

  it("covers all six categories with five templates each", () => {
    expect(CATEGORIES).toHaveLength(6);
    for (const c of CATEGORIES) {
      expect(TEMPLATES.filter((t) => t.category === c)).toHaveLength(5);
    }
  });

  it("every template has a unique id, title, description, photo tip and at least one field", () => {
    const ids = new Set(TEMPLATES.map((t) => t.id));
    expect(ids.size).toBe(30);
    for (const t of TEMPLATES) {
      expect(t.title.length).toBeGreaterThan(0);
      expect(t.description.length).toBeGreaterThan(0);
      expect(t.photoTip.length).toBeGreaterThan(0);
      expect(parseFields(t.caption).length).toBeGreaterThan(0);
    }
  });
});

describe("parseFields", () => {
  it("extracts unique field names in order", () => {
    expect(parseFields("Meet [Product]. [Product] is [Great].")).toEqual(["Product", "Great"]);
  });
});

describe("fillCaption", () => {
  it("replaces filled fields and keeps unfilled ones as [Field]", () => {
    const out = fillCaption("Meet [Product]. Available [Date].", { Product: "Synora" });
    expect(out).toBe("Meet Synora. Available [Date].");
  });

  it("trims values and ignores blank values", () => {
    const out = fillCaption("Win [Prize].", { Prize: "   " });
    expect(out).toBe("Win [Prize].");
  });
});
