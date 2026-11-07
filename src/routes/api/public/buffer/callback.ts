import { createFileRoute } from "@tanstack/react-router";
import { callbackUrl } from "@/lib/pkce.server";
import { retryAfterMinutes } from "@/lib/rate-limit";

// Never log tokens. Errors are reported by short codes only.
export const Route = createFileRoute("/api/public/buffer/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const fail = (code: string) => Response.redirect(new URL(`/?error=${code}`, url), 302);

        if (url.searchParams.get("error")) return fail("access_denied");
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        if (!code || !state) return fail("missing_code");

        const clientId = process.env["BUFFER_CLIENT_ID"];
        const clientSecret = process.env["BUFFER_CLIENT_SECRET"];
        if (!clientId || !clientSecret) return fail("not_configured");

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // 1. Verify and consume state (single use).
        const { data: row } = await supabaseAdmin
          .from("oauth_states").select("code_verifier, expires_at").eq("state", state).maybeSingle();
        await supabaseAdmin.from("oauth_states").delete().eq("state", state);
        if (!row || new Date(row.expires_at).getTime() < Date.now()) return fail("invalid_state");

        // 2. Exchange the code.
        const tokenRes = await fetch("https://auth.buffer.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
          body: new URLSearchParams({
            grant_type: "authorization_code",
            code,
            redirect_uri: callbackUrl(request),
            client_id: clientId,
            client_secret: clientSecret,
            code_verifier: row.code_verifier,
          }),
        });
        if (!tokenRes.ok) {
          console.error("buffer token exchange failed", tokenRes.status);
          return fail("token_exchange");
        }
        const tok = (await tokenRes.json()) as {
          access_token?: string; refresh_token?: string; expires_in?: number;
        };
        if (!tok.access_token) return fail("token_exchange");

        // 3. Fetch the Buffer account (one retry after 2s if Buffer rate-limits us).
        const lookup = () => fetch("https://api.buffer.com", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok.access_token}` },
          body: JSON.stringify({ query: "query { account { id email } }" }),
        });
        let apiRes = await lookup();
        if (apiRes.status === 429) {
          await new Promise((r) => setTimeout(r, 2000));
          apiRes = await lookup();
        }
        if (apiRes.status === 429) {
          console.error("buffer account lookup rate limited", apiRes.status);
          const mins = retryAfterMinutes(apiRes.headers);
          const to = new URL("/?error=rate_limited", url);
          if (mins) to.searchParams.set("retry", String(mins));
          return Response.redirect(to, 302);
        }
        const api = apiRes.ok
          ? ((await apiRes.json()) as { data?: { account?: { id?: string; email?: string | null } } })
          : null;
        const account = api?.data?.account;
        if (!account?.id) {
          console.error("buffer account lookup failed", apiRes.status);
          return fail("account_lookup");
        }
        const accountId = String(account.id);
        const bufferEmail = account.email ?? null;

        // 4. Find or create the user keyed by Buffer account id.
        const loginEmail = `buffer-${accountId.toLowerCase().replace(/[^a-z0-9]/g, "")}@users.synora.app`;
        const { data: existing } = await supabaseAdmin
          .from("buffer_connections").select("user_id").eq("buffer_account_id", accountId).maybeSingle();
        let userId = existing?.user_id;
        const metadata = { buffer_account_id: accountId, buffer_email: bufferEmail };
        if (!userId) {
          const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
            email: loginEmail, email_confirm: true, user_metadata: metadata,
          });
          if (error || !created.user) return fail("user_create");
          userId = created.user.id;
        } else {
          await supabaseAdmin.auth.admin.updateUserById(userId, { user_metadata: metadata });
        }

        // 5. Store tokens server-side only.
        const { error: saveErr } = await supabaseAdmin.from("buffer_connections").upsert({
          buffer_account_id: accountId,
          user_id: userId,
          access_token: tok.access_token,
          refresh_token: tok.refresh_token ?? null,
          token_expires_at: tok.expires_in ? new Date(Date.now() + tok.expires_in * 1000).toISOString() : null,
          updated_at: new Date().toISOString(),
        });
        if (saveErr) return fail("save_failed");

        // 6. Issue a one-time sign-in link for this user.
        const { data: link, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
          type: "magiclink", email: loginEmail,
        });
        const hashed = link?.properties?.hashed_token;
        if (linkErr || !hashed) return fail("signin_failed");

        const done = new URL("/auth/complete", url);
        done.searchParams.set("token_hash", hashed);
        return Response.redirect(done.toString(), 302);
      },
    },
  },
});
