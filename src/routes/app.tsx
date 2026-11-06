import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/app")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/" });
    return { user: data.user };
  },
  head: () => ({
    meta: [
      { title: "Your account — Synora" },
      { name: "description", content: "Your Synora account." },
      { property: "og:title", content: "Your account — Synora" },
      { property: "og:description", content: "Your Synora account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AppPage,
});

function AppPage() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const meta = (user.user_metadata ?? {}) as { buffer_email?: string | null; name?: string };
  const email = meta.buffer_email || "no email provided";

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-soft">
        <p className="text-sm uppercase tracking-widest text-muted-foreground">Signed in</p>
        {meta.name && <h1 className="mt-3 font-display text-3xl text-foreground">{meta.name}</h1>}
        <p className="mt-3 font-display text-2xl text-foreground break-all">{email}</p>
        <button
          onClick={signOut}
          className="mt-8 inline-flex h-11 items-center rounded-full border border-border px-6 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          Sign out
        </button>
      </div>
    </main>
  );
}
