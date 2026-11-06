import { createFileRoute } from "@tanstack/react-router";
import { callbackUrl, randomToken, s256 } from "@/lib/pkce.server";

export const Route = createFileRoute("/api/public/buffer/start")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const clientId = process.env["BUFFER_CLIENT_ID"];
        if (!clientId) return Response.redirect(new URL("/?error=not_configured", request.url), 302);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const state = randomToken(24);
        const verifier = randomToken(48);
        const challenge = await s256(verifier);

        // Clean up expired rows, then store this attempt (10-minute lifetime).
        await supabaseAdmin.from("oauth_states").delete().lt("expires_at", new Date().toISOString());
        const { error } = await supabaseAdmin.from("oauth_states").insert({
          state,
          code_verifier: verifier,
          expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        });
        if (error) return Response.redirect(new URL("/?error=start_failed", request.url), 302);

        const auth = new URL("https://auth.buffer.com/auth");
        auth.searchParams.set("response_type", "code");
        auth.searchParams.set("client_id", clientId);
        auth.searchParams.set("redirect_uri", callbackUrl(request));
        auth.searchParams.set("scope", "account:read offline_access");
        auth.searchParams.set("code_challenge", challenge);
        auth.searchParams.set("code_challenge_method", "S256");
        auth.searchParams.set("state", state);
        return Response.redirect(auth.toString(), 302);
      },
    },
  },
});
