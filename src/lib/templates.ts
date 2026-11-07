// Static template library for the Discover page. No network or AI calls at runtime.

export type TemplateCategory =
  | "Launch & Promo"
  | "Behind the Scenes"
  | "Community"
  | "Tips & Education"
  | "Seasonal & Events"
  | "Brand & Story";

export const CATEGORIES: TemplateCategory[] = [
  "Launch & Promo",
  "Behind the Scenes",
  "Community",
  "Tips & Education",
  "Seasonal & Events",
  "Brand & Story",
];

export type Template = {
  id: string;
  title: string;
  category: TemplateCategory;
  description: string;
  caption: string;
  photoTip: string;
  image: string; // slug under src/assets/templates/
};

export const TEMPLATES: Template[] = [
  // LAUNCH & PROMO
  {
    id: "new-product-launch",
    title: "New product launch",
    category: "Launch & Promo",
    description: "Introduce something new with a clear call to action.",
    caption: "Meet [Product]. [One sentence about what it does]. Available [Date or place]. [Call to action]",
    photoTip: "Photograph the product alone on a clean, pastel background with soft daylight.",
    image: "01-new-product-launch",
  },
  {
    id: "limited-time-offer",
    title: "Limited-time offer",
    category: "Launch & Promo",
    description: "Create gentle urgency around an offer with an end date.",
    caption: "[Offer] on [Product] until [Date]. [Why it is worth it]. [Call to action]",
    photoTip: "Show the product next to a small blank tag or card to suggest a special price.",
    image: "02-limited-time-offer",
  },
  {
    id: "back-in-stock",
    title: "Back in stock",
    category: "Launch & Promo",
    description: "Tell followers a sold-out favorite is available again.",
    caption: "[Product] is back. [Why people loved it]. Get yours before it is gone. [Call to action]",
    photoTip: "Photograph a tidy shelf with several of the same item neatly arranged.",
    image: "03-back-in-stock",
  },
  {
    id: "flash-sale",
    title: "Flash sale",
    category: "Launch & Promo",
    description: "Announce a short, hours-long sale with clear claiming steps.",
    caption: "[Hours] only: [Discount] on [Product or collection]. [How to claim it]",
    photoTip: "Use a stopwatch beside simple shopping bags to suggest limited time.",
    image: "04-flash-sale",
  },
  {
    id: "giveaway",
    title: "Giveaway",
    category: "Launch & Promo",
    description: "Run a giveaway with simple entry steps and an end date.",
    caption: "Giveaway time! Win [Prize]. To enter: [Step 1], [Step 2]. Ends [Date].",
    photoTip: "Photograph a wrapped gift box with a little confetti around it.",
    image: "05-giveaway",
  },
  // BEHIND THE SCENES
  {
    id: "how-it-is-made",
    title: "How it is made",
    category: "Behind the Scenes",
    description: "Walk followers through your making process in a few steps.",
    caption: "Here is how [Product] is made: [Step 1], [Step 2], [Step 3]. [What you care about in the process]",
    photoTip: "Show your workbench with tools and raw materials laid out.",
    image: "06-how-it-is-made",
  },
  {
    id: "meet-the-maker",
    title: "Meet the maker",
    category: "Behind the Scenes",
    description: "Introduce yourself and the reason you started.",
    caption: "Hi, I am [Name]. I started [Business] because [Reason]. Fun fact: [Fun fact]",
    photoTip: "Photograph your tidy desk with a notebook and a coffee cup.",
    image: "07-meet-the-maker",
  },
  {
    id: "workspace-tour",
    title: "Workspace tour",
    category: "Behind the Scenes",
    description: "Give a peek into where the work happens.",
    caption: "A peek into our workspace: [What happens here]. Favorite corner: [Corner].",
    photoTip: "Show a corner of your workspace with plants and a lamp.",
    image: "08-workspace-tour",
  },
  {
    id: "packing-an-order",
    title: "Packing an order",
    category: "Behind the Scenes",
    description: "Share the moment an order heads out the door.",
    caption: "Packing orders today: [Product] is heading to [Place]. [Thank you message]",
    photoTip: "Photograph a kraft parcel tied with twine and a blank tag.",
    image: "09-packing-an-order",
  },
  {
    id: "a-day-in-the-life",
    title: "A day in the life",
    category: "Behind the Scenes",
    description: "Summarize a typical day in three short beats.",
    caption: "Today at [Business]: [Morning], [Afternoon], [Evening].",
    photoTip: "Use a flat-lay of a planner, pen and coffee to suggest the day's rhythm.",
    image: "10-a-day-in-the-life",
  },
  // COMMUNITY
  {
    id: "thank-you",
    title: "Thank you",
    category: "Community",
    description: "Thank your community for a milestone or moment.",
    caption: "Thank you for [Reason or milestone]. [What it means to you]. Next: [What is coming]",
    photoTip: "Photograph a blank card with a few small flowers beside it.",
    image: "11-thank-you",
  },
  {
    id: "customer-shoutout",
    title: "Customer shoutout",
    category: "Community",
    description: "Share a real customer quote you have permission to use.",
    caption: "A customer said: [Paste a real quote you have permission to share]. [Your reply]",
    photoTip: "Use empty paper speech-bubble shapes to suggest a conversation.",
    image: "12-customer-shoutout",
  },
  {
    id: "milestone",
    title: "Milestone",
    category: "Community",
    description: "Celebrate a number worth marking with your followers.",
    caption: "[Number] [followers, orders or years]! [Thank you]. To celebrate: [Treat or offer]",
    photoTip: "Photograph a cupcake with a candle and a little confetti.",
    image: "13-milestone",
  },
  {
    id: "question-of-the-day",
    title: "Question of the day",
    category: "Community",
    description: "Ask a simple question to start a comment thread.",
    caption: "[Question]? Tell us in the comments. [Why you are asking]",
    photoTip: "Use empty paper speech bubbles on a soft backdrop.",
    image: "14-question-of-the-day",
  },
  {
    id: "this-or-that",
    title: "This or that",
    category: "Community",
    description: "Let followers vote between two options.",
    caption: "[Option A] or [Option B]? Vote in the comments. [Reason you are curious]",
    photoTip: "Photograph two similar objects side by side on a split background.",
    image: "15-this-or-that",
  },
  // TIPS & EDUCATION
  {
    id: "quick-tip",
    title: "Quick tip",
    category: "Tips & Education",
    description: "Share one useful tip and why it works.",
    caption: "Quick tip: [Tip]. Why it works: [Reason]. Save this for later.",
    photoTip: "Photograph a lightbulb beside a notebook.",
    image: "16-quick-tip",
  },
  {
    id: "how-to-use",
    title: "How to use",
    category: "Tips & Education",
    description: "Explain how to use your product in three steps.",
    caption: "How to use [Product] in 3 steps: 1) [Step 1] 2) [Step 2] 3) [Step 3]",
    photoTip: "Photograph three small objects in a row to suggest steps.",
    image: "17-how-to-use",
  },
  {
    id: "common-mistake",
    title: "Common mistake",
    category: "Tips & Education",
    description: "Point out a common mistake and the better way.",
    caption: "Common mistake: [Mistake]. Do this instead: [Better way].",
    photoTip: "Photograph a pencil and eraser on grid paper.",
    image: "18-common-mistake",
  },
  {
    id: "myth-vs-fact",
    title: "Myth vs fact",
    category: "Tips & Education",
    description: "Correct a common myth with a short fact.",
    caption: "Myth: [Myth]. Fact: [Fact]. [Short explanation]",
    photoTip: "Use two blank cards, one light and one dark, side by side.",
    image: "19-myth-vs-fact",
  },
  {
    id: "before-you-buy",
    title: "Before you buy",
    category: "Tips & Education",
    description: "Help buyers know what to check before purchasing.",
    caption: "Before you buy [Product type], check: [Item 1], [Item 2], [Item 3].",
    photoTip: "Photograph a clipboard with a blank checklist and a pen.",
    image: "20-before-you-buy",
  },
  // SEASONAL & EVENTS
  {
    id: "holiday-greeting",
    title: "Holiday greeting",
    category: "Seasonal & Events",
    description: "Send warm holiday wishes from your business.",
    caption: "Happy [Holiday] from all of us at [Business]. [Wish]. [Opening hours if changed]",
    photoTip: "Photograph string lights and pine branches on a neutral surface.",
    image: "21-holiday-greeting",
  },
  {
    id: "seasonal-collection",
    title: "Seasonal collection",
    category: "Seasonal & Events",
    description: "Announce a new seasonal collection.",
    caption: "Our [Season] collection is here: [Highlights]. [Call to action]",
    photoTip: "Use seasonal leaves and fabric swatches in soft tones.",
    image: "22-seasonal-collection",
  },
  {
    id: "event-announcement",
    title: "Event announcement",
    category: "Seasonal & Events",
    description: "Invite followers to an event with date, place and RSVP.",
    caption: "Join us at [Event] on [Date] at [Place]. [What to expect]. [How to RSVP]",
    photoTip: "Photograph a blank ticket with string lights around it.",
    image: "23-event-announcement",
  },
  {
    id: "opening-hours-update",
    title: "Opening hours update",
    category: "Seasonal & Events",
    description: "Share updated opening hours for a period.",
    caption: "Our hours this [Period]: [Hours]. Find us at [Place].",
    photoTip: "Photograph a blank hanging wooden door sign.",
    image: "24-opening-hours-update",
  },
  {
    id: "year-in-review",
    title: "Year in review",
    category: "Seasonal & Events",
    description: "Look back on the year with three highlights.",
    caption: "[Year] in review: [Highlight 1], [Highlight 2], [Highlight 3]. Thank you.",
    photoTip: "Photograph calendar pages and a pen with no readable text.",
    image: "25-year-in-review",
  },
  // BRAND & STORY
  {
    id: "our-story",
    title: "Our story",
    category: "Brand & Story",
    description: "Tell how your business began and why it exists.",
    caption: "[Business] began [When or where]. We make [What] because [Why]. Next: [What is coming]",
    photoTip: "Photograph a small seedling in a pot on a windowsill.",
    image: "26-our-story",
  },
  {
    id: "our-values",
    title: "Our values",
    category: "Brand & Story",
    description: "Share the three values that guide your work.",
    caption: "What we care about: [Value 1], [Value 2], [Value 3].",
    photoTip: "Photograph three smooth stacked stones.",
    image: "27-our-values",
  },
  {
    id: "product-spotlight",
    title: "Product spotlight",
    category: "Brand & Story",
    description: "Highlight one product, its key feature and who it is for.",
    caption: "Spotlight: [Product]. [Key feature]. Made for [Who it is for]. [Call to action]",
    photoTip: "Photograph a single product on a pedestal under soft light.",
    image: "28-product-spotlight",
  },
  {
    id: "before-and-after",
    title: "Before and after",
    category: "Brand & Story",
    description: "Show the difference your product or process makes.",
    caption: "Before: [Before]. After: [After]. Made with [Product or process]. [Call to action]",
    photoTip: "Use two matching frames, one dim and one bright.",
    image: "29-before-and-after",
  },
  {
    id: "best-seller-story",
    title: "Best-seller story",
    category: "Brand & Story",
    description: "Tell the story behind your most loved product.",
    caption: "Our best-seller: [Product]. People love it because [Reason]. [Call to action]",
    photoTip: "Photograph a small podium of stacked boxes with a ribbon.",
    image: "30-best-seller-story",
  },
];

/** Extract unique [Field] names from a caption skeleton, in order of appearance. */
export function parseFields(caption: string): string[] {
  const fields: string[] = [];
  const re = /\[([^\]]+)\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(caption)) !== null) {
    const name = m[1]!.trim();
    if (name && !fields.includes(name)) fields.push(name);
  }
  return fields;
}

/** Fill a caption skeleton with values; unfilled fields stay as [Field name]. */
export function fillCaption(caption: string, values: Record<string, string>): string {
  return caption.replace(/\[([^\]]+)\]/g, (raw, name: string) => {
    const v = values[name.trim()]?.trim();
    return v ? v : raw;
  });
}
