import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getBufferChannels, type ChannelsResult } from "@/lib/buffer.functions";

function Channels() {
  const fetchChannels = useServerFn(getBufferChannels);
  const [res, setRes] = useState<ChannelsResult | null>(null);
  useEffect(() => {
    fetchChannels().then(setRes).catch(() => setRes({ status: "error" }));
  }, [fetchChannels]);

  return (
    <section className="mt-8">
      <h2 className="text-sm uppercase tracking-widest text-muted-foreground">Connected channels</h2>
      {!res && <p className="mt-3 text-sm text-muted-foreground">Loading…</p>}
      {res?.status === "reconnect" && (
        <div className="mt-3">
          <p className="text-sm text-muted-foreground">Your Buffer connection has expired.</p>
          <a
            href="/api/public/buffer/start"
            className="mt-3 inline-flex h-11 items-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground"
          >
            Reconnect Buffer
          </a>
        </div>
      )}
      {res?.status === "error" && (
        <p className="mt-3 text-sm text-muted-foreground">Couldn't load your channels right now. Please refresh.</p>
      )}
      {res?.status === "ok" &&
        (res.channels.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No channels connected in Buffer yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border rounded-xl border border-border">
            {res.channels.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="truncate text-foreground">{c.name}</span>
                <span className="text-xs uppercase tracking-wide text-muted-foreground">{c.service}</span>
              </li>
            ))}
          </ul>
        ))}
    </section>
  );
}

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
        <Channels />
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
