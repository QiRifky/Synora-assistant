import { createFileRoute, Link } from "@tanstack/react-router";
import { ImagePlus, Wand2, Save, ShieldCheck, Lock, HandMetal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BeforeAfter } from "@/components/before-after";
import { useSignInCooldown } from "@/hooks/use-sign-in-cooldown";
import { rateLimitWaitMessage, waitCountdown } from "@/lib/rate-limit";

const MESSAGES: Record<string, string> = {
  access_denied: "Looks like the Buffer sign-in was cancelled.",
  invalid_state: "That sign-in link expired. Please start again.",
  not_configured: "Sign-in isn't set up yet. Please try again shortly.",
  rate_limited: "Buffer is receiving too many requests right now. Please wait a few minutes and try again.",
  account_lookup: "We signed you in with Buffer but couldn't read your Buffer account. Please try again in a moment.",
};

const SIGN_IN_CLASS =
  "inline-flex h-12 items-center rounded-full bg-primary px-8 text-base font-medium text-primary-foreground shadow-soft motion-safe:transition-transform motion-safe:hover:-translate-y-0.5";

// Example before/after pairs. Add real photo URLs here when available; a
// missing image shows a clearly labeled placeholder instead.
const SHOWCASE: { style: string; before: string | null; after: string | null }[] = [
  { style: "Clean", before: null, after: null },
  { style: "Warm", before: null, after: null },
  { style: "Bright", before: null, after: null },
  { style: "Calm", before: null, after: null },
];

const STEPS = [
  {
    icon: ImagePlus,
    title: "Upload a photo",
    body: "Add a product or lifestyle photo to a new post.",
  },
  {
    icon: Wand2,
    title: "Magic Photo and Photo to Post",
    body: "Synora improves the photo and writes a caption with hashtags from what is visible in it.",
  },
  {
    icon: Save,
    title: "Review and save to Buffer",
    body: "Read everything, change what you like, then save it to Buffer as a draft.",
  },
];

const FEATURES = [
  {
    title: "Magic Photo",
    body: "Improves light, color and background. It never changes your product, and never adds people, text or logos.",
  },
  {
    title: "Photo to Post",
    body: "Writes the caption and hashtags from what is visible in the photo — no invented facts or claims.",
  },
  {
    title: "Magic Caption",
    body: "Polishes your text in your language, keeping your meaning, links and hashtags.",
  },
  {
    title: "Publish now",
    body: "Posts immediately, only when you confirm. Everything else stays a draft until you decide.",
  },
];

const TRUST = [
  { icon: HandMetal, text: "Your original photo is always kept until you choose" },
  { icon: ShieldCheck, text: "Nothing is posted automatically" },
  { icon: Lock, text: "Your Buffer access is never shown or shared" },
];

export const Route = createFileRoute("/")({
  validateSearch: (s: Record<string, unknown>): { error?: string | undefined; retry?: number | undefined } => ({
    error: typeof s["error"] === "string" ? s["error"] : undefined,
    // The callback already converts Buffer seconds to minutes; don't divide twice.
    retry: Number.isFinite(Number(s["retry"])) && Number(s["retry"]) > 0 ? Number(s["retry"]) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Synora: calm social publishing for Buffer" },
      { name: "description", content: "Synora improves your photo, writes the caption and saves it to Buffer as a draft. Nothing is ever published without your approval." },
      { property: "og:title", content: "Synora: calm social publishing for Buffer" },
      { property: "og:description", content: "Make your photos post-ready. Calmly. Synora improves your photo, writes the caption and saves it to Buffer as a draft." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  const { error, retry } = Route.useSearch();
  const { remaining, startSignIn } = useSignInCooldown(error === "rate_limited", retry);
  const waiting = remaining > 0;

  return (
    <main className="bg-background text-foreground">
      <div className="mx-auto w-full max-w-5xl px-6">
        <section className="flex flex-col items-center justify-center py-20 text-center sm:min-h-[80vh] sm:py-28">
          <h1 className="max-w-2xl font-display text-5xl leading-tight text-foreground sm:text-6xl">
            Make your photos post-ready. Calmly.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted-foreground">
            Synora improves your photo, writes the caption and saves it to Buffer as a draft.
          </p>

          {error && (
            <div
              role="alert"
              className="mt-8 w-full max-w-md rounded-xl border border-border bg-muted px-5 py-4 text-sm text-foreground"
            >
              <p>
                {error === "rate_limited" && retry
                  ? `Buffer is receiving too many requests right now. ${rateLimitWaitMessage(retry)}.`
                  : MESSAGES[error] ?? "Something went wrong while signing you in."}
              </p>
              {waiting && <p className="mt-2 text-xs text-muted-foreground" role="timer">Sign-in available in {waitCountdown(remaining)}</p>}
              <Button variant="link" disabled={waiting} onClick={startSignIn} className="mt-2 h-auto p-0 font-medium underline underline-offset-4">
                Try again
              </Button>
            </div>
          )}

          <Button disabled={waiting} onClick={startSignIn} className={`${SIGN_IN_CLASS} mt-10`}>
            Sign in with Buffer
          </Button>
          <p className="mt-4 text-sm text-muted-foreground">
            Nothing is ever published without your approval.
          </p>
        </section>

        <section className="border-t border-border py-16 sm:py-20">
          <h2 className="text-center font-display text-3xl text-foreground sm:text-4xl">See the difference</h2>
          <p className="mx-auto mt-4 max-w-xl text-center text-base text-muted-foreground">
            Drag the handle to compare each photo before and after Magic Photo.
          </p>
          <div className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-2">
            {SHOWCASE.map((item) => (
              <BeforeAfter key={item.style} before={item.before} after={item.after} style={item.style} />
            ))}
          </div>
          <p className="mt-6 text-center text-xs text-muted-foreground">
            Real results from Synora's Magic Photo. Your results may vary.
          </p>
        </section>

        <section className="border-t border-border py-16 sm:py-20">
          <h2 className="font-display text-3xl text-foreground sm:text-4xl">How it works</h2>
          <ol className="mt-10 grid grid-cols-1 gap-10 sm:grid-cols-3">
            {STEPS.map((step, index) => (
              <li key={step.title}>
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-primary">
                    <step.icon className="h-5 w-5" aria-hidden />
                  </span>
                  <span className="font-display text-2xl text-primary">{index + 1}</span>
                </div>
                <h3 className="mt-4 text-base font-semibold text-foreground">{step.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="border-t border-border py-16 sm:py-20">
          <h2 className="font-display text-3xl text-foreground sm:text-4xl">What Synora does</h2>
          <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="rounded-2xl border border-border bg-card p-6 shadow-soft"
              >
                <h3 className="text-base font-semibold text-foreground">{feature.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{feature.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-border py-16 sm:py-20">
          <h2 className="font-display text-3xl text-foreground sm:text-4xl">Calm by default</h2>
          <ul className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-3">
            {TRUST.map((point) => (
              <li key={point.text} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-primary">
                  <point.icon className="h-4 w-4" aria-hidden />
                </span>
                <p className="text-sm text-foreground">{point.text}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="border-t border-border py-20 text-center sm:py-24">
          <h2 className="font-display text-3xl text-foreground sm:text-4xl">Ready when you are.</h2>
          <Button disabled={waiting} onClick={startSignIn} className={`${SIGN_IN_CLASS} mt-8`}>
            Sign in with Buffer
          </Button>
        </section>
      </div>

      <footer className="border-t border-border py-8">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center justify-between gap-4 px-6 text-sm text-muted-foreground sm:flex-row">
          <p className="max-w-md text-center text-xs sm:text-left">
            Synora is an independent app that works with Buffer. Not affiliated with Buffer.
          </p>
          <div className="flex gap-6">
            <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
            <Link to="/terms" className="hover:text-foreground">Terms</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
