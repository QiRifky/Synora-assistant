import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ChannelsResult =
  | { status: "ok"; channels: { id: string; name: string; service: string }[] }
  | { status: "reconnect" }
  | { status: "error" };

async function gql(token: string, query: string) {
  const res = await fetch("https://api.buffer.com", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ query }),
  });
  const body = (await res.json().catch(() => null)) as
    | { data?: any; errors?: { message?: string; extensions?: { code?: string } }[] }
    | null;
  const unauth =
    res.status === 401 ||
    res.status === 403 ||
    !!body?.errors?.some((e) => /UNAUTH|FORBIDDEN/i.test(e.extensions?.code ?? "") || /unauth|expired|invalid token/i.test(e.message ?? ""));
  return { ok: res.ok && !body?.errors?.length, unauth, data: body?.data };
}

// Never log or return tokens.
export const getBufferChannels = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ChannelsResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: conn } = await supabaseAdmin
      .from("buffer_connections")
      .select("access_token, token_expires_at")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!conn?.access_token) return { status: "reconnect" };
    if (conn.token_expires_at && new Date(conn.token_expires_at).getTime() < Date.now()) {
      return { status: "reconnect" };
    }

    const acct = await gql(conn.access_token, "query { account { organizations { id } } }");
    if (acct.unauth) return { status: "reconnect" };
    if (!acct.ok) {
      console.error("buffer organizations lookup failed");
      return { status: "error" };
    }
    const orgs: { id: string }[] = acct.data?.account?.organizations ?? [];
    const channels: { id: string; name: string; service: string }[] = [];
    for (const org of orgs) {
      const r = await gql(
        conn.access_token,
        `query { channels(input: { organizationId: ${JSON.stringify(org.id)} }) { id name displayName service } }`,
      );
      if (r.unauth) return { status: "reconnect" };
      if (!r.ok) {
        console.error("buffer channels lookup failed");
        return { status: "error" };
      }
      for (const c of r.data?.channels ?? []) {
        channels.push({ id: String(c.id), name: c.displayName || c.name || "Unnamed", service: String(c.service ?? "") });
      }
    }
    return { status: "ok", channels };
  });
