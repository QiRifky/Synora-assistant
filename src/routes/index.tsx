import { createFileRoute, Link } from "@tanstack/react-router";
import { ImagePlus, Wand2, Save, ShieldCheck, Lock, HandMetal, Images, FileText, Send, Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SynoraFlow } from "@/components/synora-flow";
import { BeforeAfter } from "@/components/before-after";
import { IconFolder, type FolderIcon } from "@/components/ui/icon-folder";
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
    title: "Improve and write",
    body: "Use Magic Photo, Photo to Post or Magic Caption, only when you tap them.",
  },
  {
    icon: Save,
    title: "Review and save to Buffer",
    body: "Read everything, change what you like, then save it to Buffer as a draft.",
  },
];

const FEATURES = [
  {
    icon: Wand2,
    title: "Magic Photo",
    body: "Improves light, color and background. It never changes your product.",
  },
  {
    icon: ImagePlus,
    title: "Photo to Post",
    body: "Writes a caption and hashtags from what is visible in the photo.",
  },
  {
    icon: Type,
    title: "Magic Caption",
    body: "Polishes your text in your own language, keeping meaning, links and hashtags.",
  },
  {
    icon: Images,
    title: "Media for every channel",
    body: "Upload JPG, PNG or WebP photos, with limits that follow the channel you choose.",
  },
  {
    icon: FileText,
    title: "Drafts first",
    body: "Save as a draft to Buffer and review before anything goes out.",
  },
  {
    icon: Send,
    title: "Publish now",
    body: "Posts immediately, only when you confirm.",
  },
];

// Simple inline SVG marks in one calm green, matching the Synora style.
// Logos remain trademarks of their owners; paths via Simple Icons (CC0).
const PLATFORM_PATHS: Record<string, string> = {
  Instagram:
    "M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z",
  Facebook:
    "M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z",
  LinkedIn:
    "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z",
  X: "M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z",
  TikTok:
    "M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z",
  Pinterest:
    "M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.401.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.354-.629-2.758-1.379l-.749 2.848c-.269 1.045-1.004 2.352-1.498 3.146 1.123.345 2.306.535 3.55.535 6.607 0 11.985-5.365 11.985-11.987C23.97 5.39 18.592.026 11.985.026L12.017 0z",
};

const PLATFORMS = ["Instagram", "Facebook", "LinkedIn", "X", "TikTok", "Pinterest"] as const;

const CHANNEL_ICONS: FolderIcon[] = PLATFORMS.map((name) => ({
  label: name,
  node: <svg viewBox="0 0 24 24" aria-hidden="true"><path d={PLATFORM_PATHS[name]} /></svg>,
}));

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
    <main id="top" className="bg-background text-foreground">
      <div className="mx-auto w-full max-w-5xl px-6">
        <section className="flex flex-col items-center justify-center py-20 text-center sm:min-h-[80vh] sm:py-28">
          <h1 className="max-w-2xl font-display text-5xl leading-tight text-foreground sm:text-6xl">
            Write, polish and save your social posts. Calmly.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted-foreground">
            Synora improves your photos, writes and refines your captions, and saves everything to Buffer as a draft.
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
          <div className="mx-auto mt-10 grid max-w-3xl grid-cols-1 gap-8 sm:grid-cols-2">
            {SHOWCASE.map((item) => (
              <BeforeAfter key={item.style} before={item.before} after={item.after} style={item.style} />
            ))}
          </div>
          <p className="mt-6 text-center text-xs text-muted-foreground">
            Real results from Synora's Magic Photo. Your results may vary.
          </p>

          <div className="mx-auto mt-12 max-w-3xl">
            <h3 className="text-center font-display text-2xl text-foreground">Magic Caption</h3>
            <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
              {["Before", "After"].map((tag) => (
                <div key={tag} className="rounded-2xl border border-border bg-card p-6 shadow-soft">
                  <span className="text-xs uppercase tracking-widest text-muted-foreground">{tag}</span>
                  <p className="mt-3 text-sm text-muted-foreground">Example text coming soon</p>
                </div>
              ))}
            </div>
          </div>
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

      </div>
      <SynoraFlow />
      <div className="mx-auto w-full max-w-5xl px-6">
        <section className="grid grid-cols-1 border-t border-border py-16 sm:py-20 lg:grid-cols-2 lg:items-center lg:gap-16">
          <div className="min-w-0 text-left">
            <h2 className="font-display text-3xl text-foreground sm:text-4xl">
              Works with the channels you already use in Buffer
            </h2>
            <p className="mt-4 max-w-xl text-base text-muted-foreground">
              Buffer connects to many social platforms. Connect them in Buffer, and Synora helps you
              write and save posts for them.
            </p>
            <p className="mt-8 max-w-xl text-xs text-muted-foreground">
              Available channels depend on your Buffer account and plan.
            </p>
          </div>
          <div className="mt-12 flex min-w-0 justify-center lg:mt-0">
            <IconFolder title="Your Buffer channels" icons={CHANNEL_ICONS} tags={[...PLATFORMS]} theme="light" spread={58} />
          </div>
        </section>

        <section className="border-t border-border py-16 sm:py-20">
          <h2 className="font-display text-3xl text-foreground sm:text-4xl">Everything in one calm place</h2>
          <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="rounded-2xl border border-border bg-card p-6 shadow-soft"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-primary">
                  <feature.icon className="h-4 w-4" aria-hidden />
                </span>
                <h3 className="mt-4 text-base font-semibold text-foreground">{feature.title}</h3>
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
