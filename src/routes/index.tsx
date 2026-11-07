import { createFileRoute, Link } from "@tanstack/react-router";

const MESSAGES: Record<string, string> = {
  access_denied: "Looks like the Buffer sign-in was cancelled.",
  invalid_state: "That sign-in link expired. Please start again.",
  not_configured: "Sign-in isn't set up yet. Please try again shortly.",
  rate_limited: "Buffer is receiving too many requests right now. Please wait a few minutes and try again.",
  account_lookup: "We signed you in with Buffer but couldn't read your Buffer account. Please try again in a moment.",
};

const SIGN_IN_HREF = "/api/public/buffer/start";

const SIGN_IN_CLASS =
  "inline-flex h-12 items-center rounded-full bg-primary px-8 text-base font-medium text-primary-foreground shadow-soft transition-transform hover:-translate-y-0.5";

const STEPS = [
  {
    title: "Connect your Buffer account",
    body: "Sign in with Buffer. Synora sees the channels you already have.",
  },
  {
    title: "Paste an article link and pick a channel",
    body: "Drop in the URL of something you've read, then choose where the post should go.",
  },
  {
    title: "Review the generated post and save it as a draft in Buffer",
    body: "Read the draft, change the wording, then save it to Buffer as a draft.",
  },
];

const REASONS = [
  {
    title: "Your Buffer, your control",
    body: "Synora only saves drafts. It never publishes or schedules anything on its own.",
  },
  {
    title: "Works with your channels",
    body: "Synora uses the channels already connected to your Buffer — nothing to set up again.",
  },
  {
    title: "Secure by design",
    body: "Buffer access stays on the server, never in your browser.",
  },
];

export const Route = createFileRoute("/")({
  validateSearch: (s: Record<string, unknown>): { error?: string | undefined; retry?: number | undefined } => ({
    error: typeof s["error"] === "string" ? s["error"] : undefined,
    retry: Number.isInteger(Number(s["retry"])) && Number(s["retry"]) > 0 && Number(s["retry"]) < 1440 ? Number(s["retry"]) : undefined,
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
  const { error, retry } = Route.useSearch();

  return (
    <main className="bg-background text-foreground">
      <div className="mx-auto w-full max-w-3xl px-6">
        <section className="flex flex-col items-center justify-center py-20 text-center sm:min-h-[80vh] sm:py-24">
          <h1 className="font-display text-6xl text-foreground sm:text-7xl">Synora</h1>
          <p className="mt-5 text-lg text-muted-foreground">
            Calm clarity for your Buffer social publishing.
          </p>
          <p className="mt-4 max-w-md text-base text-muted-foreground">
            Turn a link you've already read into a short post you can review, then save it to
            Buffer as a draft.
          </p>

          {error && (
            <div
              role="alert"
              className="mt-8 w-full max-w-md rounded-xl border border-border bg-muted px-5 py-4 text-sm text-foreground"
            >
              <p>
                {error === "rate_limited" && retry
                  ? `Buffer is receiving too many requests right now. Try again in about ${retry} minute${retry === 1 ? "" : "s"}.`
                  : MESSAGES[error] ?? "Something went wrong while signing you in."}
              </p>
              <a href={SIGN_IN_HREF} className="mt-2 inline-block font-medium text-primary underline underline-offset-4">
                Try again
              </a>
            </div>
          )}

          <a href={SIGN_IN_HREF} className={`${SIGN_IN_CLASS} mt-10`}>
            Sign in with Buffer
          </a>
          <p className="mt-4 text-sm text-muted-foreground">
            Synora saves drafts. It never publishes on its own.
          </p>
        </section>

        <section className="border-t border-border py-16">
          <h2 className="font-display text-3xl text-foreground">How it works</h2>
          <ol className="mt-8 grid grid-cols-1 gap-8 sm:grid-cols-3">
            {STEPS.map((step, index) => (
              <li key={step.title}>
                <span className="font-display text-2xl text-primary">{index + 1}</span>
                <h3 className="mt-3 text-base font-semibold text-foreground">{step.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="border-t border-border py-16">
          <h2 className="font-display text-3xl text-foreground">Why Synora</h2>
          <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-3">
            {REASONS.map((reason) => (
              <div
                key={reason.title}
                className="rounded-2xl border border-border bg-card p-6 shadow-soft"
              >
                <h3 className="text-base font-semibold text-foreground">{reason.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{reason.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-border py-20 text-center">
          <h2 className="font-display text-3xl text-foreground">
            Try it with the next article you read
          </h2>
          <p className="mt-3 text-base text-muted-foreground">
            Sign in with Buffer and Synora shows your channels, then waits for your link.
          </p>
          <a href={SIGN_IN_HREF} className={`${SIGN_IN_CLASS} mt-8`}>
            Sign in with Buffer
          </a>
        </section>
      </div>

      <footer className="border-t border-border py-6">
        <div className="mx-auto flex w-full max-w-3xl flex-col items-center justify-between gap-3 px-6 text-sm text-muted-foreground sm:flex-row">
          <span>Synora</span>
          <div className="flex gap-6">
            <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
            <Link to="/terms" className="hover:text-foreground">Terms</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
