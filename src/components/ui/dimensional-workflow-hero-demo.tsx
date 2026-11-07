import type { CSSProperties } from "react";
import DimensionalWorkflowHero, {
  type ScrollExperienceContent,
} from "@/components/ui/dimensional-workflow-hero";

// Synora content for the scroll-driven "How it works" experience. All scenes
// are illustrative; the page makes no Buffer or AI calls.
export const synoraHeroContent: ScrollExperienceContent = {
  ariaLabel: "How Synora works, in three steps",
  skip: { label: "Skip animated demonstration", target: "#features" },
  intro: {
    eyebrow: "HOW IT WORKS",
    title: { lines: ["From photo to post.", "In three calm steps."], emphasis: "calm" },
    description: [
      "Upload a photo, improve it and write the caption,",
      "then save everything to Buffer as a draft.",
    ],
    cta: "See the steps",
  },
  chapters: [
    {
      kind: "workflow",
      name: "Upload a photo",
      tag: "STEP 1 · YOUR MEDIA",
      title: ["Start with", "your own photo."],
      description:
        "Add a product or lifestyle photo to a new post. Synora checks it against the channel you choose.",
      color: "#3d7358",
      steps: [
        { title: "Add your photo", body: "JPG, PNG or WebP, up to the channel's limits." },
        { title: "Pick a channel", body: "Choose from the channels already in your Buffer." },
        { title: "Limits checked", body: "Size and count follow the channel you picked." },
      ],
      status: "Original always kept",
      panelLabel: "Example flow",
      footerLabel: "Your files stay yours",
      diagram: {
        nodes: [
          { icon: "mail", label: "Your photo", caption: "JPG · PNG · WEBP", x: 5, y: 34, step: 0, color: "#4c8a6a" },
          { icon: "shield-check", label: "Channel limits", caption: "SIZE & COUNT CHECKED", x: 35, y: 34, step: 1, color: "#7fae94" },
          { icon: "check", label: "Ready to write", caption: "ATTACHED TO POST", x: 72, y: 34, step: 2, color: "#2f5d46" },
        ],
        edges: [
          { from: 0, to: 1 },
          { from: 1, to: 2 },
        ],
        note: "YOUR ORIGINAL FILE IS NEVER OVERWRITTEN",
        gradient: ["#4c8a6a", "#7fae94", "#2f5d46"],
      },
    },
    {
      kind: "workflow",
      name: "Improve and write",
      tag: "STEP 2 · MAGIC TOOLS",
      title: ["Polish the photo.", "Shape the words."],
      description:
        "Magic Photo, Photo to Post and Magic Caption help when you ask for them. Nothing changes without a tap.",
      color: "#5a8a70",
      steps: [
        { title: "Magic Photo", body: "Improves light, color and background. Your product stays untouched." },
        { title: "Photo to Post", body: "Suggests a caption and hashtags from what is visible." },
        { title: "Magic Caption", body: "Polishes your text in your language, keeping links and hashtags." },
      ],
      status: "Only when you tap",
      panelLabel: "Example flow",
      footerLabel: "Undo is always available",
      diagram: {
        nodes: [
          { icon: "bot", label: "Magic Photo", caption: "LIGHT & COLOR", x: 5, y: 19, step: 0, color: "#4c8a6a" },
          { icon: "message-square", label: "Photo to Post", caption: "CAPTION IDEAS", x: 35, y: 19, step: 1, color: "#7fae94" },
          { icon: "check", label: "Magic Caption", caption: "YOUR TONE KEPT", x: 72, y: 19, step: 2, color: "#2f5d46" },
          { icon: "user-round", label: "Your review", caption: "YOU DECIDE", x: 35, y: 65, step: 2, color: "#b98a4e" },
        ],
        edges: [
          { from: 0, to: 1 },
          { from: 1, to: 2 },
          { from: 1, to: 3, out: "bottom", in: "top" },
        ],
        note: "EVERY SUGGESTION IS EDITABLE · UNDO KEEPS YOUR TEXT",
        gradient: ["#4c8a6a", "#7fae94", "#b98a4e"],
      },
    },
    {
      kind: "build",
      name: "Save to Buffer",
      tag: "STEP 3 · DRAFTS FIRST",
      title: ["Review everything.", "Then save as a draft."],
      description:
        "Read the final text, change what you like, and save it to Buffer as a draft. Publishing stays in your hands.",
      color: "#2f5d46",
      steps: [
        { title: "Review the post", body: "Text, channels and media, exactly as they will be saved." },
        { title: "Save as a draft", body: "Synora sends it to Buffer as a draft, never published." },
        { title: "You stay in control", body: "Scheduling and publishing only happen when you confirm." },
      ],
      status: "Nothing posts automatically",
      footer: "Drafts first · Queue and schedule only on your confirmation",
    },
  ],
  finale: {
    eyebrow: "CALM BY DEFAULT",
    title: { lines: ["Nothing publishes", "without you."], emphasis: "without you." },
    cta: { label: "Sign in with Buffer", href: "#sign-in" },
  },
  navLabel: "Choose a step",
  footer: {
    disclaimer: "ILLUSTRATIVE WORKFLOWS · NOT A LIVE DASHBOARD",
    scrollHint: "SCROLL TO EXPLORE",
  },
};

// Host fonts and the cream/green palette flow in through the existing CSS
// variables; only the display/body font mapping is set here.
const synoraHeroStyle = {
  "--font-hero-display": "var(--font-display)",
  "--font-hero-body": "var(--font-sans)",
} as CSSProperties;

export default function SynoraWorkflowHero() {
  return <DimensionalWorkflowHero content={synoraHeroContent} style={synoraHeroStyle} />;
}
