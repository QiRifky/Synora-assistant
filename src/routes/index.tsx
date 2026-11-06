import { createFileRoute, Link } from "@tanstack/react-router";

const MESSAGES: Record<string, string> = {
  access_denied: "Looks like the Buffer sign-in was cancelled.",
  invalid_state: "That sign-in link expired. Please start again.",
  not_configured: "Sign-in isn't set up yet. Please try again shortly.",
};

export const Route = createFileRoute("/")({
  validateSearch: (s: Record<string, unknown>): { error?: string | undefined } => ({
    error: typeof s["error"] === "string" ? s["error"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Synora — Sign in with Buffer" },
      { name: "description", content: "Synora brings calm clarity to your Buffer social publishing." },
      { property: "og:title", content: "Synora" },
      { property: "og:description", content: "Synora brings calm clarity to your Buffer social publishing." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  const { error } = Route.useSearch();
  return (
    <main className="flex min-h-screen flex-col bg-background px-6">
      <section className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center text-center">
        <h1 className="font-display text-6xl text-foreground sm:text-7xl">Synora</h1>
        <p className="mt-5 text-lg text-muted-foreground">
          Calm clarity for your Buffer social publishing.
        </p>

        {error && (
          <div role="alert" className="mt-8 w-full rounded-xl border border-border bg-muted px-5 py-4 text-sm text-foreground">
            <p>{MESSAGES[error] ?? "Something went wrong while signing you in."}</p>
            <a href="/api/public/buffer/start" className="mt-2 inline-block font-medium text-primary underline underline-offset-4">
              Try again
            </a>
          </div>
        )}

        <a
          href="/api/public/buffer/start"
          className="mt-10 inline-flex h-12 items-center rounded-full bg-primary px-8 text-base font-medium text-primary-foreground shadow-soft transition-transform hover:-translate-y-0.5"
        >
          Sign in with Buffer
        </a>
      </section>
      <footer className="flex justify-center gap-6 py-6 text-sm text-muted-foreground">
        <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
        <Link to="/terms" className="hover:text-foreground">Terms</Link>
      </footer>
    </main>
  );
}
