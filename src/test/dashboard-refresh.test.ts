import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ row: null as Record<string, unknown> | null, claimed: true, claims: vi.fn(), uid: "", queries: [] as string[] }));
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => {
  const builder = { middleware: () => builder, inputValidator: () => builder, handler: (fn: (value: unknown) => unknown) => () => fn({ context: { userId: state.uid } }) };
  return builder;
} }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: {
  rpc: (...args: unknown[]) => { state.claims(...args); return Promise.resolve({ data: state.claimed, error: null }); },
  from: (table: string) => {
    let changes: Record<string, unknown> | null = null;
    const result = () => { if (changes) state.row = { ...state.row, ...changes }; return { data: table === "buffer_connections" ? { buffer_account_id: "account", access_token: "mock-only", token_expires_at: null } : state.row, error: null }; };
    const chain = { select: () => chain, eq: () => chain, update: (value: Record<string, unknown>) => { changes = value; return chain; }, maybeSingle: () => Promise.resolve(result()), then: (resolve: (value: unknown) => unknown) => Promise.resolve(result()).then(resolve) };
    return chain;
  },
} }));
vi.mock("@/lib/trends.functions", () => ({ charLimit: () => 280 }));
import { refreshDashboardSnapshot } from "@/lib/buffer.functions";
let sequence = 0;
beforeEach(() => {
  state.uid = `test-owner-${sequence++}`; state.claimed = true; state.row = null; state.queries = []; state.claims.mockClear();
  vi.stubGlobal("fetch", vi.fn(async (_url, options) => {
    const { query } = JSON.parse(options.body); state.queries.push(query);
    const data = query.includes("organizations") ? { account: { organizations: [{ id: "org", channelCount: 0, limits: { channels: 3 } }] } } : query.includes("channels(input") ? { o0: [] } : { draft0: { edges: [], pageInfo: { hasNextPage: false } }, scheduled0: { edges: [], pageInfo: { hasNextPage: false } }, sent0: { edges: [], pageInfo: { hasNextPage: false } } };
    return new Response(JSON.stringify({ data }), { status: 200 });
  }));
});
afterEach(() => vi.unstubAllGlobals());
describe("Explicit dashboard refresh", () => {
  it("makes exactly three cold-cache requests, requesting at most 50 posts, and persists success", async () => {
    const before = Date.now(); const result = await refreshDashboardSnapshot();
    expect(result.status).toBe("ok"); expect(state.queries).toHaveLength(3);
    const limits = [...(state.queries[2] ?? "").matchAll(/first: (\d+)/g)].map((m) => Number(m[1]));
    expect(limits.reduce((a,b) => a+b,0)).toBe(50);
    expect(state.row?.["snapshot"]).toEqual(result.snapshot);
    const until = Date.parse(result.cooldownUntil ?? ""); expect(until).toBeGreaterThanOrEqual(before); expect(until).toBeLessThanOrEqual(Date.now());
    expect(state.row?.["lock_until"]).toBeNull();
  });
  it("makes zero requests when another refresh owns the database lock", async () => {
    state.claimed = false; const result = await refreshDashboardSnapshot();
    expect(result.status).toBe("cooldown"); expect(state.queries).toHaveLength(0);
  });
  it("preserves the old snapshot and exact Retry-After cooldown without retrying", async () => {
    const old = { channels: [], posts: [], counts: {} }; state.row = { snapshot: old, updated_at: "2026-11-07T00:00:00Z" };
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ errors: [{ extensions: { code: "RATE_LIMITED" } }] }), { status: 429, headers: { "retry-after": "30" } })); vi.stubGlobal("fetch", fetchMock);
    const before = Date.now(); const result = await refreshDashboardSnapshot();
    expect(result.status).toBe("busy"); expect(result.snapshot).toEqual(old); expect(result.updatedAt).toBe("2026-11-07T00:00:00Z"); expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(Date.parse(result.cooldownUntil ?? "")).toBeGreaterThanOrEqual(before+30_000);
    expect(Date.parse(result.cooldownUntil ?? "")).toBeLessThanOrEqual(Date.now()+30_000);
  });
  it("preserves the old snapshot on other errors", async () => {
    const old = { channels: [], posts: [], counts: {} }; state.row = { snapshot: old };
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 500 })));
    const result = await refreshDashboardSnapshot(); expect(result.status).toBe("error"); expect(result.snapshot).toEqual(old);
  });
});