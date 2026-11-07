import DimensionalWorkflowHero, { type ScrollExperienceContent } from "@/components/ui/dimensional-workflow-hero";

// Illustrative only: no Buffer or AI calls are made by this section.
const content: ScrollExperienceContent = {
  ariaLabel: "How Synora turns an idea into a Buffer draft",
  skip: { label: "Skip animated walkthrough", target: "#synora-flow-end" },
  intro: {
    eyebrow: "A CALM FLOW",
    title: { lines: ["From idea", "to a ready draft."], emphasis: "a ready draft." },
    description: ["Write, polish and save your posts.", "You stay in control at every step."],
    cta: "See the flow",
  },
  chapters: [
    {
      kind: "workflow",
      name: "Write",
      tag: "START WITH AN IDEA",
      title: ["An article or a thought.", "A first draft in seconds."],
      description: "Paste an article link or type an idea, pick one of your Buffer channels, and get a draft that fits it.",
      color: "#2f6b4f",
      steps: [
        { title: "Bring your source", body: "An article link, an idea or a few words." },
        { title: "Pick a channel", body: "Choose from the channels already in your Buffer." },
        { title: "Get a draft", body: "A post that respects the channel's limits." },
      ],
      status: "Channels from Buffer",
      diagram: {
        nodes: [
          { icon: "message-square", label: "Your idea", caption: "LINK OR TEXT", x: 5, y: 34, step: 0, color: "#4f8a6b" },
          { icon: "user-round", label: "Your channel", caption: "FROM BUFFER", x: 37, y: 34, step: 1, color: "#8a7a4f" },
          { icon: "bot", label: "Draft", caption: "FITS THE LIMIT", x: 72, y: 34, step: 2, color: "#2f6b4f" },
        ],
        edges: [{ from: 0, to: 1 }, { from: 1, to: 2 }],
        note: "ONE IDEA · ONE TAILORED DRAFT",
      },
    },
    {
      kind: "workflow",
      name: "Polish",
      tag: "IMPROVE, DON'T INVENT",
      title: ["Same meaning.", "A clearer voice."],
      description: "Magic Caption rewrites in the style you choose, keeping your facts, links, mentions and hashtags. Undo anytime.",
      color: "#2f6b4f",
      steps: [
        { title: "Choose a style", body: "Friendly, punchier, professional and more." },
        { title: "Rewrite", body: "Same language and meaning, no invented facts." },
        { title: "Keep or undo", body: "You decide what stays." },
      ],
      status: "Your words, refined",
      diagram: {
        nodes: [
          { icon: "message-square", label: "Your text", caption: "ORIGINAL", x: 5, y: 19, step: 0, color: "#4f8a6b" },
          { icon: "shield-check", label: "Facts kept", caption: "LINKS & TAGS", x: 37, y: 19, step: 1, color: "#8a7a4f" },
          { icon: "check", label: "Polished", caption: "READY TO REVIEW", x: 72, y: 19, step: 2, color: "#2f6b4f" },
          { icon: "user-round", label: "Undo", caption: "ALWAYS AVAILABLE", x: 37, y: 65, step: 2, color: "#a06a4f" },
        ],
        edges: [{ from: 0, to: 1 }, { from: 1, to: 2 }, { from: 1, to: 3, out: "bottom", in: "top" }],
        note: "BETTER WORDING · SAME MEANING",
      },
    },
    {
      kind: "workflow",
      name: "Save",
      tag: "YOUR BUFFER, YOUR CONTROL",
      title: ["Saved as a draft.", "Nothing goes out alone."],
      description: "Save to Buffer as a draft, or queue, schedule or publish only when you click and confirm.",
      color: "#2f6b4f",
      steps: [
        { title: "Review", body: "Edit the final text and media." },
        { title: "Save to Buffer", body: "Drafts land in your own Buffer account." },
        { title: "You confirm", body: "Synora never publishes without your confirmation." },
      ],
      status: "Drafts by default",
      diagram: {
        nodes: [
          { icon: "check", label: "Final post", caption: "REVIEWED", x: 5, y: 34, step: 0, color: "#4f8a6b" },
          { icon: "database", label: "Buffer draft", caption: "SAVED", x: 37, y: 34, step: 1, color: "#8a7a4f" },
          { icon: "bell", label: "Your call", caption: "CONFIRM TO SEND", x: 72, y: 34, step: 2, color: "#2f6b4f" },
        ],
        edges: [{ from: 0, to: 1 }, { from: 1, to: 2 }],
        note: "SAVED SAFELY · SENT ONLY ON CONFIRM",
      },
    },
  ],
  finale: {
    eyebrow: "CALM CLARITY",
    title: { lines: ["Your posts, ready.", "You stay in control."], emphasis: "You stay in control." },
    cta: { label: "Back to top", href: "#top" },
  },
  navLabel: "Choose a step",
  footer: { disclaimer: "ILLUSTRATIVE FLOW · NOT A LIVE DASHBOARD", scrollHint: "SCROLL TO EXPLORE" },
};

export function SynoraFlow() {
  return (
    <>
      <DimensionalWorkflowHero
        content={content}
        style={{ "--font-hero-display": "var(--font-display)" } as React.CSSProperties}
      />
      <div id="synora-flow-end" tabIndex={-1} style={{ height: 1 }} />
    </>
  );
}
