import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — Synora" },
      { name: "description", content: "The terms for using Synora." },
      { property: "og:title", content: "Terms of Service — Synora" },
      { property: "og:description", content: "The terms for using Synora." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <main className="mx-auto max-w-2xl px-6 py-16 text-foreground">
      <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">← Synora</Link>
      <h1 className="mt-6 font-display text-4xl">Terms of Service</h1>
      <div className="mt-6 space-y-4 text-muted-foreground">
        <p>By using Synora you agree to use it lawfully and in line with Buffer's own terms.</p>
        <p>Synora is provided as is, without warranties. We may update or discontinue features at any time.</p>
        <p>You may stop using Synora and disconnect your Buffer account whenever you like.</p>
      </div>
    </main>
  ),
});
