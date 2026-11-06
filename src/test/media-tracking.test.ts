import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), upsert: vi.fn(), eq: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: {
  rpc: mocks.rpc,
  from: () => ({ upsert: mocks.upsert, delete: () => ({ eq: () => ({ eq: mocks.eq }) }) }),
} }));
import { protectMedia, recordSavedMedia, finishMediaOperation } from "@/lib/media-tracking.server";

describe("Saved attachment protection", () => {
  const media = [{ path: "owner/file.png", type: "image" as const }];
  beforeEach(() => { vi.clearAllMocks(); mocks.rpc.mockResolvedValue({ error: null }); mocks.upsert.mockResolvedValue({ error: null }); mocks.eq.mockResolvedValue({ error: null }); });
  it("reserves media before a save", async () => {
    const operation = await protectMedia("owner", media);
    expect(mocks.rpc).toHaveBeenCalledWith("protect_media_save", { p_user_id: "owner", p_paths: ["owner/file.png"], p_operation: operation });
  });
  it.each(["draft", "idea", "queue", "schedule"] as const)("records paths and saved %s identifiers", async (kind) => {
    await recordSavedMedia("owner", media, "buffer-item", kind);
    expect(mocks.upsert).toHaveBeenCalledWith([{ user_id: "owner", path: "owner/file.png", buffer_id: "buffer-item", kind }], { onConflict: "path,buffer_id,kind" });
  });
  it("does not remove pending protection when reference recording fails", async () => {
    mocks.upsert.mockResolvedValue({ error: new Error("failure") });
    await expect(recordSavedMedia("owner", media, "item", "draft")).rejects.toThrow("files remain protected");
    expect(mocks.eq).not.toHaveBeenCalled();
  });
  it("finishes only the current operation's pending protection", async () => {
    await finishMediaOperation("operation");
    expect(mocks.eq).toHaveBeenCalledWith("kind", "pending");
  });
});