import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth/complete")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({ token_hash: String(s["token_hash"] ?? "") }),
  head: () => ({ meta: [{ title: "Signing you in — Synora" }, { name: "robots", content: "noindex" }] }),
  component: Complete,
});

function Complete() {
  const { token_hash } = Route.useSearch();
  const navigate = useNavigate();
  useEffect(() => {
    (async () => {
      const { error } = token_hash
        ? await supabase.auth.verifyOtp({ token_hash, type: "magiclink" })
        : { error: new Error("missing") };
      if (error) navigate({ to: "/", search: { error: "signin_failed" }, replace: true });
      else navigate({ to: "/app", replace: true });
    })();
  }, [token_hash, navigate]);
  return (
    <main className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
      Signing you in…
    </main>
  );
}
