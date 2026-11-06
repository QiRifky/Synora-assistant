import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Synora" },
      { name: "description", content: "How Synora handles your data." },
      { property: "og:title", content: "Privacy Policy — Synora" },
      { property: "og:description", content: "How Synora handles your data." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <main className="mx-auto max-w-2xl px-6 py-16 text-foreground">
      <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">← Synora</Link>
      <h1 className="mt-6 font-display text-4xl">Privacy Policy</h1>
      <div className="mt-6 space-y-4 text-muted-foreground">
        <p>Synora signs you in with your Buffer account. We receive your Buffer account ID and, if available, your email address.</p>
        <p>Buffer access tokens are stored securely on our servers only, are never sent to your browser, and are used solely to provide Synora's features.</p>
        <p>We do not sell your data. You can ask us to delete your account and stored data at any time.</p>
      </div>
    </main>
  ),
});
