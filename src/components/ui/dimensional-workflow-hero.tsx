// @ts-nocheck -- vendored third-party animation component; strict-index checks not applied.
import { Fragment, useId, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { MessageSquare, Bot, Check, UserRound, Mail, ShieldCheck, Database, Bell, GitBranch, LayoutGrid, Settings, Play } from "lucide-react";

export type Side = "left" | "right" | "top" | "bottom";

export type IconName =
  | "message-square"
  | "bot"
  | "check"
  | "user-round"
  | "mail"
  | "shield-check"
  | "database"
  | "bell";

export type ChapterStep = { title: string; body: string };

export type DiagramNode = {
  icon: IconName;
  label: string;
  caption: string;
  /** Position inside the canvas, in percent. */
  x: number;
  y: number;
  /** Which chapter step lifts this node. */
  step: number;
  color: string;
};

export type DiagramEdge = { from: number; to: number; out?: Side; in?: Side };

export type WorkflowDiagram = {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  note: string;
  gradient?: [string, string, string];
};

export type FinishedSite = {
  src: string;
  alt: string;
  label: string;
  width: number;
  height: number;
};

type ChapterBase = {
  name: string;
  tag: string;
  title: string[];
  description: string;
  color: string;
  steps: ChapterStep[];
  /** Status chip text on the illustrative panel. */
  status: string;
  panelLabel?: string;
  footerLabel?: string;
};

export type WorkflowChapter = ChapterBase & {
  kind: "workflow";
  diagram: WorkflowDiagram;
};

/** Database, code, then finished-site scenes. Without `finishedSite`, a neutral page mock is drawn. */
export type BuildChapter = ChapterBase & {
  kind: "build";
  footer: string;
  finishedSite?: FinishedSite;
  /** Custom panel markup; .build-scene children transition in sequence. */
  panel?: ReactNode;
};

export type Chapter = WorkflowChapter | BuildChapter;

/** Lines joined by line breaks; `emphasis` is the substring rendered in the accent color. */
export type EmphasisText = { lines: string[]; emphasis?: string };

/**
 * Public content API:
 * - ariaLabel: accessible name of the complete experience.
 * - skip: label and #id of a focusable element after the hero (tabIndex={-1}).
 * - intro: eyebrow, title lines/optional emphasized substring, description lines and CTA label.
 * - chapters: WorkflowChapter (typed nodes/edges) or BuildChapter (custom React panel).
 * - finale: eyebrow/title and real destination link; navLabel/footer supply all remaining copy.
 * Nodes use percentage x/y and zero-based step indices. Edges use zero-based node indices;
 * invalid indices are ignored. Give chapters unique names and put the same information
 * in adjacent title/description/steps, since diagram panels are decorative aria-hidden content.
 * Build panels can contain up to three .build-scene children for sequential transitions.
 * Dependencies: react, gsap, @gsap/react, lucide-react. All CSS is included in this file.
 * Themes: complete --color-background/foreground/card/card-foreground/muted-foreground/
 * border/primary/primary-foreground values; .dark or [data-theme="dark"] chooses dark mode.
 * The core imports no fonts. Optional --font-hero-body/display/mono inherit host fonts.
 * --workflow-panel-background/foreground/muted/border, --workflow-canvas-background,
 * --workflow-panel-accent, --workflow-shadow-color, --workflow-signal-color and
 * --workflow-code-purple/blue/gold customize the illustrative artwork independently.
 * Phone layouts retain 3D when allowed. OS reduced motion renders chapters in reading
 * order without pinning. Each instance cleans up its own GSAP context on unmount.
 */
export type ScrollExperienceContent = {
  ariaLabel: string;
  skip: { label: string; target: string };
  intro: {
    eyebrow: string;
    title: EmphasisText;
    description: string[];
    cta: string;
  };
  chapters: Chapter[];
  finale: {
    eyebrow: string;
    title: EmphasisText;
    cta?: { label: string; href: string } | undefined;
  };
  navLabel: string;
  footer: { disclaimer: string; scrollHint: string };
};

export type ScrollExperienceMotion = {
  /** Scroll distance per chapter, in viewport heights. Default 1.35. */
  viewportsPerChapter?: number;
  /** Cap on the scroll distance per chapter in px, so tall screens need no extra wheel turns. Default 1350. */
  maxChapterScroll?: number;
  /** Scroll smoothing in seconds. Default 0.65; clamped to zero or above. */
  scrub?: number;
};

const heroStyles = ".af-experience{--af-default-background:Canvas;--af-default-foreground:CanvasText;--af-default-muted:color-mix(in srgb,CanvasText 72%,Canvas);--af-default-card:Canvas;--af-default-accent:Highlight;--af-default-action:CanvasText;--af-default-action-ink:Canvas;--af-default-border:color-mix(in srgb,CanvasText 30%,Canvas);--af-background:var(--color-background,var(--af-default-background));--af-foreground:var(--color-foreground,var(--af-default-foreground));--af-muted:color-mix(in srgb,var(--color-muted-foreground,var(--af-default-muted)) 70%,var(--af-foreground));--af-border:var(--color-border,var(--af-default-border));--af-panel:var(--workflow-panel-background,var(--color-card,var(--af-default-card)));--af-panel-ink:var(--workflow-panel-foreground,var(--color-card-foreground,var(--af-foreground)));--af-panel-muted:var(--workflow-panel-muted,color-mix(in srgb,var(--color-muted-foreground,var(--af-default-muted)) 70%,var(--af-panel-ink)));--af-canvas:var(--workflow-canvas-background,color-mix(in srgb,var(--af-panel) 95%,var(--mint)));--af-depth:var(--workflow-shadow-color,var(--color-foreground,CanvasText));--af-signal:var(--workflow-signal-color,var(--color-chart-4,var(--mint)));--af-code-purple:var(--workflow-code-purple,var(--color-chart-2,var(--af-panel-ink)));--af-code-blue:var(--workflow-code-blue,var(--color-chart-1,var(--af-panel-ink)));--af-code-gold:var(--workflow-code-gold,var(--color-chart-3,var(--af-panel-ink)));color-scheme:light}:where(.dark,[data-theme=dark]) .af-experience,.af-experience.dark{color-scheme:dark}.af-experience .flow-panel{--af-border:var(--workflow-panel-border,var(--color-border,var(--af-default-border)))}.af-experience .chapter-nav button{min-height:44px}.af-experience .flow-copy li{opacity:1}.af-experience .flow-copy .eyebrow{color:color-mix(in srgb,var(--mint) 70%,var(--af-foreground))}.af-experience{width:100%;min-width:0;flex-shrink:0;font-family:var(--font-hero-body, var(--font-sans, ui-sans-serif, system-ui, sans-serif));color:var(--af-foreground);background:var(--af-background);font-synthesis:none;--mint: var(--color-hero-accent, var(--color-primary, var(--af-default-accent)))}.af-experience *{box-sizing:border-box}.af-experience a{color:inherit;text-decoration:none}.af-experience button{font:inherit;color:inherit;cursor:pointer;border:0}.af-experience button,.af-experience a{-webkit-tap-highlight-color:transparent}.af-experience button:focus-visible,.af-experience a:focus-visible{outline:2px solid var(--mint);outline-offset:6px}.af-experience svg{width:20px;height:20px;stroke-width:1.6}.af-experience .skip{position:fixed;top:-100px;left:20px;background:var(--af-foreground);color:var(--af-background);padding:15px;z-index:100}.af-experience .skip:focus{top:10px}.af-experience .viewport{height:100svh;min-height:650px;position:relative;overflow:hidden}.af-experience .ambient{position:absolute;inset:0;background:radial-gradient(ellipse at 77% 61%,color-mix(in srgb,var(--mint) 13%,transparent),transparent 55%),linear-gradient(135deg,color-mix(in srgb,var(--af-background) 95%,var(--mint)) 0%,var(--af-background) 60%);pointer-events:none}.af-experience .intro{position:absolute;left:6%;top:clamp(32px,5vh,48px);z-index:5;max-width:min(630px,52%)}.af-experience .eyebrow{font-family:var(--font-hero-mono, var(--font-mono, ui-monospace, monospace));font-size:10px;font-weight:600;letter-spacing:2px;color:var(--af-muted);margin:0 0 24px;display:flex;align-items:center;gap:10px}.af-experience .eyebrow>span{width:6px;height:6px;background:var(--mint);border-radius:50%}.af-experience h1,.af-experience h2,.af-experience h3,.af-experience p{margin-top:0}.af-experience h1{font:500 clamp(2.75rem,5vw,4.25rem) / 1.055 var(--font-hero-display, var(--font-sans, ui-sans-serif, system-ui, sans-serif));letter-spacing:-2.5px;margin-bottom:25px}.af-experience h1 em{font-style:normal;color:var(--mint)}.af-experience p{line-height:1.65}.af-experience .intro-description{font-size:16px;color:var(--af-muted);margin-bottom:28px}.af-experience .primary{display:inline-flex;align-items:center;gap:36px;padding:16px 23px;border-radius:6px;background:var(--color-hero-action, var(--color-primary, var(--af-default-action)));color:var(--color-hero-action-ink, var(--color-primary-foreground, var(--af-default-action-ink)));font-size:13px;font-weight:600}.af-experience .primary:disabled{opacity:.55;cursor:not-allowed}.af-experience .primary:hover{background:var(--color-hero-action-hover, color-mix(in srgb,var(--color-primary, var(--af-default-action)) 85%,var(--af-background)))}.af-experience .primary span{font-size:19px}.af-experience .stage{position:absolute;left:70%;top:44%;width:800px;height:500px;transform:translate(-50%,-50%);perspective:1500px;z-index:3;pointer-events:none}.af-experience .service-chapter:nth-child(1) .stage{z-index:5}.af-experience .service-chapter:nth-child(2) .stage{z-index:4}.af-experience .service-chapter:nth-child(3) .stage{z-index:3}.af-experience .world{position:relative;width:100%;height:100%;transform-style:preserve-3d}.af-experience .flow-panel{position:absolute;left:50%;top:50%;width:800px;height:470px;background:var(--af-panel);border:1px solid var(--af-border);border-radius:15px;transform-style:preserve-3d;box-shadow:0 2px color-mix(in srgb,var(--af-panel-muted) 35%,transparent),0 9px 0 var(--af-depth),0 10px 0 var(--af-border),0 45px 80px color-mix(in srgb,var(--af-depth) 60%,transparent);--accent: var(--workflow-panel-accent, var(--color-primary, Highlight));--mint: var(--accent);color:var(--af-panel-ink)}.af-experience .panel-top{height:55px;border-bottom:1px solid var(--af-border);display:flex;align-items:center;padding:0 22px;gap:12px;background:linear-gradient(color-mix(in srgb,var(--af-panel) 90%,var(--mint)),var(--af-panel));border-radius:14px 14px 0 0}.af-experience .panel-top strong{font-size:13px;font-weight:500}.af-experience .panel-mark{color:var(--accent);display:flex}.af-experience .panel-status{margin-left:auto;font-size:10px;color:var(--af-panel-muted);background:color-mix(in srgb,var(--af-canvas) 70%,transparent);padding:6px 10px;border:1px solid var(--af-border);border-radius:5px}.af-experience .panel-status b{display:inline-block;width:5px;height:5px;background:var(--accent);border-radius:50%;margin-right:7px}.af-experience .panel-menu{font-size:25px;margin-left:12px}.af-experience .panel-body{height:370px;display:flex;transform-style:preserve-3d}.af-experience .rail{width:47px;flex-shrink:0;border-right:1px solid var(--af-border);padding:23px 14px;display:flex;flex-direction:column;gap:28px;color:var(--af-panel-muted);background:var(--af-panel)}.af-experience .rail svg{width:17px;height:17px}.af-experience .rail>svg:nth-child(2){color:var(--accent)}.af-experience .rail span{flex:1}.af-experience .panel-bottom{height:44px;display:flex;gap:16px;align-items:center;padding:0 18px;color:var(--af-panel-muted);font-size:9px;border-top:1px solid var(--af-border)}.af-experience .panel-bottom>span{display:flex;align-items:center;gap:6px}.af-experience .panel-bottom svg{width:13px;height:13px;color:var(--accent)}.af-experience .panel-bottom>span:nth-child(2){margin-left:auto}.af-experience .run-mark{border:1px solid var(--af-border);border-radius:4px;padding:5px}.af-experience .canvas{position:relative;flex:1;background-color:var(--af-canvas);background-image:radial-gradient(color-mix(in srgb,var(--af-panel-muted) 35%,transparent) 1px,transparent 1px);background-size:18px 18px;transform-style:preserve-3d}.af-experience .canvas-caption{display:flex;align-items:center;gap:8px;padding:20px 24px;font-size:9px;letter-spacing:1.3px;color:var(--af-panel-ink)}.af-experience .canvas-caption svg{width:13px;height:13px}.af-experience .connections{position:absolute;inset:0;width:100%;height:100%;overflow:visible;fill:none;stroke:var(--accent);stroke-width:1.6}.af-experience .connections .main-wire{stroke-width:2.4;stroke-linecap:round}.af-experience .connections .signal{stroke:var(--af-panel-ink);stroke-dasharray:6 140;stroke-width:2.8}.af-experience .nodes{position:absolute;inset:0;transform-style:preserve-3d}.af-experience .node{position:absolute;display:block;width:150px;height:91px;border:0;border-radius:9px;transform-style:preserve-3d}.af-experience .node-face{position:absolute;inset:0;border:1.5px solid var(--node-color);border-radius:9px;display:flex;align-items:center;justify-content:center;flex-direction:column;background:linear-gradient(145deg,color-mix(in srgb,var(--node-color) 20%,var(--af-panel)),var(--af-canvas));box-shadow:0 6px 0 var(--af-depth),0 0 18px color-mix(in srgb,var(--node-color) 15%,transparent);transform-style:preserve-3d}.af-experience .node-glow{position:absolute;inset:-1.5px;border-radius:inherit;box-shadow:0 18px 35px color-mix(in srgb,var(--af-depth) 55%,transparent),0 0 24px var(--af-border);opacity:0;pointer-events:none}.af-experience .node-icon{color:var(--node-color);margin-bottom:5px;filter:drop-shadow(0 0 7px color-mix(in srgb,var(--node-color) 45%,transparent))}.af-experience .node-icon svg{width:23px;height:23px}.af-experience .node strong{font-size:12px;font-weight:550;color:var(--af-panel-ink)}.af-experience .node small{font-size:7px;letter-spacing:1.5px;margin-top:5px;color:var(--af-panel-muted)}.af-experience .port{position:absolute;top:50%;width:7px;height:7px;background:var(--af-signal);border-radius:50%;box-shadow:0 0 9px color-mix(in srgb,var(--af-signal) 40%,transparent);z-index:2}.af-experience .port.left{left:-4px}.af-experience .port.right{right:-4px}.af-experience .port.top{top:-4px;left:calc(50% - 3.5px)}.af-experience .port.bottom{top:auto;bottom:-4px;left:50%;margin-left:-3.5px;transform:none}.af-experience .port[hidden]{display:none}.af-experience .diagram-note{position:absolute;bottom:8px;left:5%;margin:0;font-size:8px;letter-spacing:1.2px;color:var(--af-panel-ink)}.af-experience .development-panel{overflow:hidden}.af-experience .build-scenes{position:relative;height:370px;background:var(--af-canvas)}.af-experience .build-scene{position:absolute;inset:0;padding:24px 30px;background:var(--af-canvas);overflow:hidden}.af-experience .build-scene:not(:first-child){visibility:hidden}.af-experience .build-label{display:flex;justify-content:space-between;font-family:var(--font-hero-mono, var(--font-mono, ui-monospace, monospace));font-size:10px;letter-spacing:1.6px;color:var(--af-code-blue);margin-bottom:24px}.af-experience .build-label span{color:var(--af-panel-muted);font-size:9px;letter-spacing:.5px}.af-experience .data-scene h3{font-size:24px;font-weight:500;margin:0 0 24px;letter-spacing:-.5px}.af-experience .db-toolbar{padding:12px 16px;background:color-mix(in srgb,var(--af-panel) 90%,var(--mint));display:flex;justify-content:space-between;font-size:12px;border:1px solid var(--af-border)}.af-experience .db-toolbar span{color:var(--af-panel-muted);font-size:10px}.af-experience .data-scene table{width:100%;border-collapse:collapse;text-align:left;font:12px monospace}.af-experience .data-scene th,.af-experience .data-scene td{padding:13px 16px;border:1px solid var(--af-border)}.af-experience .data-scene th{color:var(--af-panel-muted);background:var(--af-panel)}.af-experience .data-scene th small{font-weight:400;color:var(--af-panel-muted);margin-left:8px}.af-experience .data-scene td b{font-size:10px;color:var(--af-code-blue);font-weight:400}.af-experience .build-note{font-size:11px;color:var(--af-panel-muted);margin:20px 0 0}.af-experience .code-scene{padding-top:18px}.af-experience .code-scene .build-label{margin-bottom:16px}.af-experience .code-tab{font-size:12px;padding-bottom:10px;border-bottom:1px solid var(--af-border);color:var(--af-panel-ink)}.af-experience .code-tab span{float:right;font-size:10px;color:var(--af-panel-muted)}.af-experience .code-scene pre{font:13px/1.55 Consolas,monospace;margin:12px 0;color:var(--af-panel-ink)}.af-experience .code-purple{color:var(--af-code-purple)}.af-experience .code-blue,.af-experience .code-mint{color:var(--af-code-blue)}.af-experience .code-gold{color:var(--af-code-gold)}.af-experience .frontend-scene{padding:0}.af-experience .frontend-scene .build-label{height:35px;margin:0;padding:12px 18px}.af-experience .frontend-scene img{width:100%;height:335px;object-fit:contain;background:var(--af-canvas)}.af-experience .site-mock{height:335px;padding:18px 22px;background:var(--af-canvas);display:flex;flex-direction:column;gap:16px}.af-experience .site-mock-nav{display:flex;align-items:center;gap:10px}.af-experience .site-mock-nav i{width:18px;height:18px;border-radius:5px;background:var(--mint)}.af-experience .site-mock-nav span{width:44px;height:6px;border-radius:3px;background:var(--af-border)}.af-experience .site-mock-nav span:first-of-type{margin-left:auto}.af-experience .site-mock-hero{flex:1;display:flex;flex-direction:column;justify-content:center;gap:10px;padding:0 6%;border-radius:8px;background:linear-gradient(120deg,var(--af-panel),var(--af-background))}.af-experience .site-mock-hero span{width:55%;height:14px;border-radius:4px;background:color-mix(in srgb,var(--af-panel-ink) 85%,transparent)}.af-experience .site-mock-hero span:nth-child(2){width:40%}.af-experience .site-mock-hero span:nth-child(3){width:48%;height:8px;background:var(--af-border)}.af-experience .site-mock-hero b{width:110px;height:26px;margin-top:8px;border-radius:6px;background:var(--mint)}.af-experience .site-mock-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.af-experience .site-mock-cards span{height:52px;border-radius:6px;background:var(--af-border);border:1px solid var(--af-border)}.af-experience .chapter-copy,.af-experience .service-chapter{display:contents}.af-experience .flow-copy{position:absolute;inset:16% auto auto 6%;width:29%}.af-experience .flow-copy .eyebrow{color:color-mix(in srgb,var(--mint) 70%,var(--af-foreground));font-size:9px}.af-experience .flow-copy h2{font:500 clamp(30px,2.8vw,43px) / 1.15 var(--font-hero-display, var(--font-sans, ui-sans-serif, system-ui, sans-serif));letter-spacing:-1.7px;margin-bottom:18px}.af-experience .flow-copy h2 span{font:inherit;letter-spacing:inherit}.af-experience .flow-description{font-size:14px;color:var(--af-muted);max-width:360px}.af-experience .flow-copy ol{list-style:none;padding:0;margin:18px 0 0}.af-experience .flow-copy li{display:flex;gap:14px;padding:9px 0;border-top:1px solid var(--af-border);opacity:1}.af-experience .flow-copy li>span{font-size:10px;color:var(--accent);padding-top:3px}.af-experience .flow-copy li h3{font-size:13px;font-weight:500;margin-bottom:3px}.af-experience .flow-copy li p{font-size:11px;color:var(--af-muted);line-height:1.5;margin:0;max-width:300px}.af-experience .chapter-nav{position:absolute;bottom:90px;left:6%;right:6%;display:flex;gap:36px;z-index:12}.af-experience .chapter-nav button{background:none;text-align:left;border-top:1px solid var(--af-border);padding:18px 0 10px;position:relative;font-size:12px;color:var(--af-muted);flex:1}.af-experience .chapter-nav button i{position:absolute;left:0;top:-1px;height:2px;width:0;background:var(--mint);transition:width .35s}.af-experience .chapter-nav button.active{color:var(--af-foreground)}.af-experience .chapter-nav button.active i{width:100%}.af-experience .chapter-nav button:hover{color:var(--af-foreground)}.af-experience .experience-footer{position:absolute;bottom:30px;left:6%;right:6%;display:flex;align-items:center;gap:25px;font-size:8px;letter-spacing:1px;color:var(--af-muted);z-index:12}.af-experience .scroll-hint{color:var(--af-muted)}.af-experience .scroll-hint b{font-size:18px;margin-left:14px}.af-experience .flow-finale{position:absolute;inset:0;z-index:10;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:70px 5%;opacity:0;visibility:hidden;pointer-events:none}.af-experience .flow-finale a{pointer-events:auto}.af-experience .flow-finale:before{content:\"\";position:absolute;inset:0;z-index:-1;background:radial-gradient(ellipse 50% 42% at 50% 50%,color-mix(in srgb,var(--af-background) 90%,transparent) 0%,color-mix(in srgb,var(--af-background) 60%,transparent) 55%,transparent 100%);pointer-events:none}.af-experience.simple .flow-finale:before{display:none}.af-experience .flow-finale .eyebrow{color:color-mix(in srgb,var(--mint) 70%,var(--af-foreground));justify-content:center;font-size:9px;margin-bottom:23px}.af-experience .flow-finale h2{font:500 clamp(40px,5.4vw,82px) / 1.05 var(--font-hero-display, var(--font-sans, ui-sans-serif, system-ui, sans-serif));letter-spacing:-.055em;margin:0 0 36px}.af-experience .flow-finale h2 em{font-style:normal;color:var(--mint)}.af-experience .flow-finale .primary{pointer-events:auto;gap:48px;padding:17px 24px}@media(min-width:1600px){.af-experience .stage{width:900px}.af-experience .flow-panel{width:850px}}@media(max-width:1100px){.af-experience h1{letter-spacing:-2px;font-size:clamp(2.5rem,5vw,3.8rem)}.af-experience .stage{left:76%}.af-experience .intro{max-width:500px}.af-experience .flow-description{font-size:12px}}@media(max-width:900px){.af-experience .intro h1{font-size:clamp(43px,8vw,72px)}.af-experience .flow-description{font-size:15px;max-width:550px}.af-experience .flow-copy ol{display:flex;gap:20px}.af-experience .flow-copy li{flex:1;display:block}.af-experience .flow-copy li>span{display:block;margin-bottom:10px}.af-experience .flow-copy li p{font-size:12px}.af-experience .experience-footer{letter-spacing:.2px}}@media(max-width:540px){.af-experience .intro-description{font-size:14px}.af-experience .intro h1{letter-spacing:-2px}.af-experience .flow-copy h2{letter-spacing:-1.2px}.af-experience .flow-copy ol{display:block}.af-experience .flow-copy li{display:flex;gap:12px}.af-experience .flow-copy li p{max-width:none}.af-experience .experience-footer{left:6%;right:6%;gap:8px}.af-experience .demo-label{font-size:6px;max-width:180px}.af-experience .flow-finale .eyebrow{font-size:8px;letter-spacing:1.3px}.af-experience .flow-finale h2{letter-spacing:-1.8px}}.af-experience.simple .ambient{height:100%}.af-experience.simple .intro{position:relative;left:auto;top:auto;padding:48px 6% 56px;max-width:none}.af-experience.simple .chapter-copy{display:block;position:relative;left:auto;top:auto;width:auto;padding:0 6%;z-index:8}.af-experience.simple .service-chapter{position:relative;display:block;padding:60px 0;border-top:1px solid var(--af-border);scroll-margin-top:100px}.af-experience.simple .flow-copy{position:relative;left:auto;top:auto;width:100%;max-width:650px;margin-bottom:35px}.af-experience.simple .intro,.af-experience.simple .flow-copy{opacity:1!important;visibility:visible!important;transform:none!important}.af-experience.simple .flow-copy li{opacity:1!important}.af-experience.simple .stage{display:block;position:relative;left:auto;top:auto;width:100%;height:auto;transform:none!important;perspective:none}.af-experience.simple .world{height:auto;transform-style:flat}.af-experience.simple .flow-panel{position:relative;left:auto;top:auto;width:800px;height:470px;transform:none;zoom:var(--panel-scale, 1)}.af-experience.simple .development-panel,.af-experience.simple .build-scenes{height:auto}.af-experience.simple .build-scene{position:relative;visibility:visible!important;opacity:1!important;transform:none!important;min-height:370px;border-bottom:1px solid var(--af-border)}.af-experience.simple .frontend-scene{min-height:0}.af-experience.simple .chapter-nav,.af-experience.simple .scroll-hint{display:none}.af-experience.simple .experience-footer{bottom:25px}.af-experience.simple .flow-finale{position:relative;inset:auto;opacity:1!important;visibility:visible!important;transform:none!important;padding:85px 6% 35px}.af-experience.simple .flow-finale h2{font-size:clamp(36px,6vw,70px)}@media(min-width:901px){.af-experience.simple .service-chapter{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.5fr);gap:40px;align-items:start}.af-experience.simple .stage{min-width:0}}@media(max-width:900px){.af-experience.simple .flow-copy h2{font-size:36px}.af-experience.simple .service-chapter{padding:45px 0}}.af-experience.simple .node strong{font-size:max(12px,calc(8px / var(--panel-scale, 1)));line-height:1.05;text-align:center;padding:0 8px}@media(max-width:540px){.af-experience.simple .intro{padding-top:40px}.af-experience.simple .node small{display:none}.af-experience.simple .flow-copy h2{font-size:32px}}@media(prefers-reduced-motion:reduce){.af-experience *,.af-experience *:before,.af-experience *:after{scroll-behavior:auto!important;transition:none!important}}.af-experience:not(.simple) .viewport{overflow:clip}.af-experience .scene{position:absolute;inset:0}.af-experience.simple .scene{display:contents}.af-experience .scroll-hint{margin-left:auto}.af-experience[data-layout=phone]:not(.simple) .viewport,.af-experience[data-layout=short]:not(.simple) .viewport{height:100svh;min-height:320px}.af-experience[data-layout=short]:not(.simple) .viewport{min-height:0}.af-experience[data-layout=phone]:not(.simple) .scene,.af-experience[data-layout=short]:not(.simple) .scene{width:100%;height:100%;transform:none}.af-experience[data-layout=phone]:not(.simple) .intro,.af-experience[data-layout=phone]:not(.simple) .flow-copy{left:6%;top:20px;width:88%;max-width:none}.af-experience[data-layout=phone]:not(.simple) .eyebrow{font-size:9px;letter-spacing:1.2px;margin-bottom:12px;gap:8px}.af-experience[data-layout=phone]:not(.simple) .intro h1,.af-experience[data-layout=phone]:not(.simple) .flow-copy h2{font-size:clamp(32px,8.8vw,38px);line-height:1.06;letter-spacing:-1.5px;margin-bottom:12px}.af-experience[data-layout=phone]:not(.simple) .intro-description,.af-experience[data-layout=phone]:not(.simple) .flow-description{font-size:14px;line-height:1.45;max-width:none;margin-bottom:16px}.af-experience[data-layout=phone]:not(.simple) .primary{min-height:44px;padding:10px 15px;font-size:12px;gap:24px}.af-experience[data-layout=phone]:not(.simple) .flow-copy ol{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:10px}.af-experience[data-layout=phone]:not(.simple) .flow-copy li{display:block;padding:7px 0}.af-experience[data-layout=phone]:not(.simple) .flow-copy li>span{display:none}.af-experience[data-layout=phone]:not(.simple) .flow-copy li h3{font-size:11px;line-height:1.3;margin:0}.af-experience[data-layout=phone]:not(.simple) .flow-copy li p{display:none}.af-experience[data-layout=phone]:not(.simple) .stage{left:50%;top:var(--stage-y,62%);width:800px;height:500px}.af-experience[data-layout=phone]:not(.simple) .flow-panel,.af-experience[data-layout=short]:not(.simple) .flow-panel{width:800px;height:470px}.af-experience[data-layout=phone]:not(.simple) .node strong{font-size:max(12px,calc(9px / var(--panel-fit,1)));line-height:1.05;text-align:center;padding:0 7px}.af-experience[data-layout=phone]:not(.simple) .node-icon{margin-bottom:5px}.af-experience[data-layout=phone]:not(.simple) .node-icon svg{width:max(23px,calc(10px / var(--panel-fit,1)));height:max(23px,calc(10px / var(--panel-fit,1)))}.af-experience[data-layout=phone]:not(.simple) .node small,.af-experience[data-layout=phone]:not(.simple) .canvas-caption,.af-experience[data-layout=phone]:not(.simple) .diagram-note{display:none}.af-experience[data-layout=phone]:not(.simple) .panel-top strong{font-size:max(13px,calc(9px / var(--panel-fit,1)))}.af-experience[data-layout=phone]:not(.simple) .panel-status{font-size:max(10px,calc(8px / var(--panel-fit,1)))}.af-experience[data-layout=phone]:not(.simple) .panel-bottom>span{font-size:max(9px,calc(7px / var(--panel-fit,1)))}.af-experience[data-layout=phone]:not(.simple) .panel-bottom>span:nth-child(2){display:none}.af-experience[data-layout=phone]:not(.simple) .panel-bottom .run-mark{margin-left:auto}.af-experience[data-layout=phone]:not(.simple) .chapter-nav,.af-experience[data-layout=short]:not(.simple) .chapter-nav{left:6%;right:6%;bottom:16px;gap:12px;overflow-x:auto;scrollbar-width:none;padding-top:2px}.af-experience[data-layout=phone]:not(.simple) .chapter-nav::-webkit-scrollbar,.af-experience[data-layout=short]:not(.simple) .chapter-nav::-webkit-scrollbar{display:none}.af-experience[data-layout=phone]:not(.simple) .chapter-nav button,.af-experience[data-layout=short]:not(.simple) .chapter-nav button{flex:1 0 auto;min-width:44px;min-height:44px;padding:12px 0 8px;font-size:11px;white-space:nowrap}.af-experience[data-layout=phone]:not(.simple) .experience-footer,.af-experience[data-layout=short]:not(.simple) .experience-footer{display:none}.af-experience[data-layout=phone]:not(.simple) .flow-finale{padding:70px 6%}.af-experience[data-layout=phone]:not(.simple) .flow-finale h2{font-size:clamp(32px,8.8vw,38px);letter-spacing:-1.5px;margin-bottom:24px}.af-experience[data-layout=short]:not(.simple) .intro,.af-experience[data-layout=short]:not(.simple) .flow-copy{top:20px;left:5%;width:38%;max-width:none}.af-experience[data-layout=short]:not(.simple) .eyebrow{font-size:9px;letter-spacing:1px;margin-bottom:10px}.af-experience[data-layout=short]:not(.simple) .intro h1,.af-experience[data-layout=short]:not(.simple) .flow-copy h2{font-size:28px;line-height:1.05;letter-spacing:-1px;margin-bottom:10px}.af-experience[data-layout=short]:not(.simple) .intro-description,.af-experience[data-layout=short]:not(.simple) .flow-description{font-size:12px;line-height:1.4;margin-bottom:12px;max-width:none}.af-experience[data-layout=short]:not(.simple) .primary{min-height:44px;font-size:11px;padding:10px 14px;gap:20px}.af-experience[data-layout=short]:not(.simple) .flow-copy ol{display:block;margin-top:8px}.af-experience[data-layout=short]:not(.simple) .flow-copy li{display:flex;gap:8px;padding:5px 0}.af-experience[data-layout=short]:not(.simple) .flow-copy li>span{display:block;margin:0;padding:0}.af-experience[data-layout=short]:not(.simple) .flow-copy li h3{font-size:11px;line-height:1.3;margin:0}.af-experience[data-layout=short]:not(.simple) .flow-copy li p{display:none}.af-experience[data-layout=short]:not(.simple) .stage{left:75%;top:var(--stage-y,46%);width:800px;height:500px}.af-experience[data-layout=short]:not(.simple) .flow-finale h2{font-size:36px;letter-spacing:-1.3px;margin-bottom:20px}@media(max-height:320px){.af-experience[data-layout=short]:not(.simple) .intro,.af-experience[data-layout=short]:not(.simple) .flow-copy{top:8px}.af-experience[data-layout=short]:not(.simple) .eyebrow{font-size:8px;margin-bottom:6px}.af-experience[data-layout=short]:not(.simple) .intro h1,.af-experience[data-layout=short]:not(.simple) .flow-copy h2{font-size:24px;margin-bottom:8px}.af-experience[data-layout=short]:not(.simple) .intro-description,.af-experience[data-layout=short]:not(.simple) .flow-description{font-size:11px;line-height:1.35;margin-bottom:8px}.af-experience[data-layout=short]:not(.simple) .flow-copy ol{margin-top:6px}.af-experience[data-layout=short]:not(.simple) .flow-copy li{padding:0}.af-experience[data-layout=short]:not(.simple) .flow-copy li h3{font-size:10px;line-height:1.2}}.af-experience[data-layout=phone]:not(.simple) .chapter-nav{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;overflow:visible}.af-experience[data-layout=phone]:not(.simple) .chapter-nav button{min-width:0;white-space:normal;text-align:left;line-height:1.25}@media(min-width:901px)and (max-width:1100px){.af-experience[data-layout=desktop]:not(.simple) .intro{width:44%;max-width:none}.af-experience[data-layout=desktop]:not(.simple) .intro h1{font-size:clamp(42px,4.6vw,50px);letter-spacing:-2px}.af-experience[data-layout=desktop]:not(.simple) .intro-description{font-size:14px}}";

const icons: Record< IconName, typeof MessageSquare> = {
  "message-square": MessageSquare,
  bot: Bot,
  check: Check,
  "user-round": UserRound,
  mail: Mail,
  "shield-check": ShieldCheck,
  database: Database,
  bell: Bell,
};



// Keep every chapter reachable when the browser requests reduced motion or
// before the scroll animation is initialized.
const staticLayoutFix = `
.af-experience.simple .viewport { height: auto; min-height: 0; overflow: visible; }
.af-experience.simple .experience-footer { position: relative; left: auto; right: auto; bottom: auto; margin: 0 6%; padding: 24px 0 30px; }
`;

function WorkflowPanel({ chapter }: { chapter: WorkflowChapter }) {
  const canvas = useRef< HTMLDivElement>(null);
  const wire = useRef< SVGPathElement>(null);
  const signal = useRef< SVGPathElement>(null);
  const gradientId = `flow-gradient-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const { diagram } = chapter;
  const [g0, g1, g2] = diagram.gradient ?? [chapter.color, chapter.color, chapter.color];

  useLayoutEffect(() => {
    const root = canvas.current!;
    const update = () => {
      const nodes = [...root.querySelectorAll< HTMLElement>(".node")];
      const point = (i: number, side: string) => {
        const n = nodes[i];
        return {
          x:
            n.offsetLeft +
            (side === "right" ? n.offsetWidth : side === "left" ? 0 : n.offsetWidth / 2),
          y:
            n.offsetTop +
            (side === "bottom" ? n.offsetHeight : side === "top" ? 0 : n.offsetHeight / 2),
        };
      };
      const d = diagram.edges.filter(({ from, to }) => nodes[from] && nodes[to])
        .map(({ from, to, out = "right", in: input = "left" }) => {
          const a = point(from, out),
            b = point(to, input);
          return out === "bottom"
            ? `M${a.x} ${a.y} C${a.x} ${(a.y + b.y) / 2},${b.x} ${(a.y + b.y) / 2},${b.x} ${b.y}`
            : `M${a.x} ${a.y} C${(a.x + b.x) / 2} ${a.y},${(a.x + b.x) / 2} ${b.y},${b.x} ${b.y}`;
        })
        .join(" ");
      wire.current?.setAttribute("d", d);
      signal.current?.setAttribute("d", d);
    };
    const observer = new ResizeObserver(update);
    observer.observe(root);
    update();
    return () => observer.disconnect();
  }, [diagram]);

  return (
    <>
      <div className="panel-top">
        <span className="panel-mark">
          <GitBranch />
        </span>
        <strong>{chapter.name}</strong>
        <span className="panel-status">
          <b />
          {chapter.panelLabel ?? chapter.status}
        </span>
        <span className="panel-menu">···</span>
      </div>
      <div className="panel-body">
        <aside className="rail">
          <LayoutGrid />
          <GitBranch />
          <MessageSquare />
          <span />
          <Settings />
        </aside>
        <div className="canvas" ref={canvas}>
          <div className="canvas-caption">
            <GitBranch />
            {chapter.tag}
          </div>
          <svg className="connections">
            <defs>
              <linearGradient id={gradientId}>
                <stop stopColor={g0} />
                <stop offset=".5" stopColor={g1} />
                <stop offset="1" stopColor={g2} />
              </linearGradient>
            </defs>
            <path className="main-wire" ref={wire} stroke={`url(#${gradientId})`} />
            <path className="signal" ref={signal} />
          </svg>
          <div className="nodes">
            {diagram.nodes.map((node, i) => {
              const Icon = icons[node.icon] ?? GitBranch;
              return (
                <div
                  className={`node node-${i}`}
                  data-step={node.step}
                  key={`${node.label}-${i}`}
                  style={
                    {
                      left: `${node.x}%`,
                      top: `${node.y}%`,
                      "--node-color": node.color,
                    } as CSSProperties
                  }
                >
                  <div className="node-face">
                    <span className="node-glow" />
                    <div className="node-icon">
                      <Icon />
                    </div>
                    <strong>{node.label}</strong>
                    <small>{node.caption}</small>
                  </div>
                  {(["left", "right", "top", "bottom"] as const).map((side) => (
                    <span
                      key={side}
                      className={`port ${side}`}
                      hidden={
                        !diagram.edges.some(
                          ({ from, to, out = "right", in: input = "left" }) =>
                            (from === i && out === side) || (to === i && input === side),
                        )
                      }
                    />
                  ))}
                </div>
              );
            })}
          </div>
          <p className="diagram-note">{diagram.note}</p>
        </div>
      </div>
      <div className="panel-bottom">
        <span>
          <ShieldCheck />
          {chapter.status}
        </span>
        <span>{chapter.footerLabel}</span>
        <span className="run-mark">
          <Play />
        </span>
      </div>
    </>
  );
}

function DevelopmentPanel({ chapter }: { chapter: BuildChapter }) {
  const site = chapter.finishedSite;
  return (
    <>
      <div className="panel-top"><strong>{chapter.name}</strong><span className="panel-status">{chapter.status}</span></div>
      <div className="build-scenes">
        <section className="build-scene data-scene">
          <div className="build-label">PLAN <span>{chapter.tag}</span></div>
          <h3>{chapter.title.join(" ")}</h3>
          <div className="db-toolbar"><b>{chapter.name}</b><span>{chapter.status}</span></div>
          <table><thead><tr><th>Step</th><th>Details</th></tr></thead>
            <tbody>{chapter.steps.map((step, index) => <tr key={`${step.title}-${index}`}><td>{step.title}</td><td>{step.body}</td></tr>)}</tbody>
          </table>
          <p className="build-note">{chapter.description}</p>
        </section>
        <section className="build-scene code-scene">
          <div className="build-label">APPLICATION <span>Illustrative React component</span></div>
          <div className="code-tab">Page.tsx <span>TypeScript / React</span></div>
          <pre><code>{`const title = ${JSON.stringify(chapter.title.join(" "))};

export default function Page() {
  return <main><h1>{title}</h1></main>;
}`}</code></pre>
        </section>
        <section className="build-scene frontend-scene">
          <div className="build-label">FINISHED WEBSITE <span>{site?.label ?? "Your finished site"}</span></div>
          {site ? <img src={site.src} alt={site.alt} width={site.width} height={site.height} /> : (
            <div className="site-mock"><div className="site-mock-nav"><i /><span /><span /><span /></div><div className="site-mock-hero"><span /><span /><span /><b /></div><div className="site-mock-cards"><span /><span /><span /></div></div>
          )}
        </section>
      </div>
      <div className="panel-bottom">{chapter.footer}</div>
    </>
  );
}

gsap.registerPlugin(ScrollTrigger, useGSAP);

// Timeline units: the intro occupies [0, INTRO), each chapter CHAPTER units,
// and the finale begins FINALE_OFFSET units into the last chapter, then holds
// FINALE_HOLD units before the pin releases.
const INTRO = 1;
const CHAPTER = 5;
const FINALE_OFFSET = 4.2;
const FINALE_HOLD = 0.8;



function RichLines({ text }: { text: EmphasisText }) {
  return (
    <>
      {text.lines.map((line, i) => {
        const at = text.emphasis ? line.indexOf(text.emphasis) : -1;
        return (
          <Fragment key={i}>
            {i > 0 && <br />}
            {at < 0 ? (
              line
            ) : (
              <>
                {line.slice(0, at)}
                <em>{text.emphasis}</em>
                {line.slice(at + text.emphasis!.length)}
              </>
            )}
          </Fragment>
        );
      })}
    </>
  );
}

export type DimensionalWorkflowHeroProps = {
  /** Required copy and scenes. Use a stable module constant or useMemo. Empty chapters render nothing. */
  content: ScrollExperienceContent;
  /** Optional CSS color for page emphasis/focus. Defaults to the host --color-primary. */
  accent?: string;
  /** Extra class on the instance root; styles stay scoped to .af-experience. */
  className?: string;
  /** Instance CSS and documented --workflow-* / --font-hero-* overrides. */
  style?: CSSProperties;
  /** Scroll distance/smoothing. Defaults: 1.35 viewports, 1350 px cap, 0.65 seconds. */
  motion?: ScrollExperienceMotion;
  /** When set, the intro CTA calls this instead of scrolling into the chapters. */
  onIntroCta?: (() => void) | undefined;
  /** Disables the intro CTA (for example during a sign-in cooldown). */
  introCtaDisabled?: boolean | undefined;
  /** Extra content rendered under the intro CTA (alerts, reassurance lines). */
  introExtra?: ReactNode | undefined;
};

export default function DimensionalWorkflowHero({ content, motion, accent, className = "", style, onIntroCta, introCtaDisabled, introExtra }: DimensionalWorkflowHeroProps) {
  const instanceId = `dimensional-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const chapters = content.chapters;
  const count = chapters.length;
  const viewportsPerChapter = Number.isFinite(motion?.viewportsPerChapter) ? Math.max(0.5, motion!.viewportsPerChapter!) : 1.35;
  const maxChapterScroll = Number.isFinite(motion?.maxChapterScroll) ? Math.max(400, motion!.maxChapterScroll!) : 1350;
  const scrub = Number.isFinite(motion?.scrub) ? Math.max(0, motion!.scrub!) : 0.65;
  const finaleAt = INTRO + (count - 1) * CHAPTER + FINALE_OFFSET;

  const root = useRef< HTMLDivElement>(null);
  const timeline = useRef< gsap.core.Timeline | null>(null);
  // -1 intro, 0..count-1 chapters, count finale.
  const position = useRef(-1);
  const restorePosition = useRef< number | null>(null);
  const [geometryRevision, setGeometryRevision] = useState(0);
  const stableProgress = useRef(0);
  const stableActive = useRef(false);
  const resizeProgress = useRef< number | null>(null);
  const rebuilding = useRef(false);

  const timeFor = (tl: gsap.core.Timeline, at: number) =>
    at < 0 ? 0 : at >= count ? finaleAt + 0.85 : tl.labels[`flow-${at}`];

  const scrollToPosition = (at: number, behavior: ScrollBehavior) => {
    const tl = timeline.current,
      trigger = tl?.scrollTrigger;
    if (tl && trigger) {
      window.scrollTo({
        top: trigger.start + (timeFor(tl, at) / tl.duration()) * (trigger.end - trigger.start),
        behavior,
      });
      return;
    }
    const element = root.current;
    const target =
      at < 0
        ? element
        : at >= count
          ? element?.querySelector(".flow-finale")
          : element?.querySelector(`[data-chapter="${at}"]`);
    target?.scrollIntoView({ behavior: "instant", block: "start" });
  };

  useGSAP(
    () => {
      if (!count || !root.current) return;
      const element = root.current;
      const viewport = element.querySelector< HTMLElement>(".viewport")!;
      const scene = element.querySelector< HTMLElement>(".scene")!;
      let panelFit = 0.85;
      let stageY = 0.45;
      let layout = "desktop";
      let fittedWidth = 0, fittedHeight = 0, fittedCopyBottom = 0;
      let fittedWindowWidth = 0, fittedWindowHeight = 0;
      const copyBottom = () => Math.max(...Array.from(element.querySelectorAll< HTMLElement>(".intro,.flow-copy"), copy => copy.offsetTop + copy.offsetHeight));
      const fitScene = () => {
        const width = element.clientWidth;
        const height = window.innerHeight;
        layout = height < 500 ? "short" : width <= 900 ? "phone" : "desktop";
        element.dataset.layout = layout;
        const sceneHeight = viewport.clientHeight;
        fittedWidth = width;
        fittedHeight = sceneHeight;
        fittedWindowWidth = window.innerWidth;
        fittedWindowHeight = window.innerHeight;
        fittedCopyBottom = copyBottom();
        if (layout === "phone") {
          const top = fittedCopyBottom + 35;
          const bottom = sceneHeight - 90;
          panelFit = Math.max(0.2, Math.min(width * 0.85 / 800, (bottom - top) / 470, 0.75));
          stageY = Math.min(sceneHeight - 90 - 235 * panelFit, Math.max(top + 235 * panelFit, sceneHeight * 0.61)) / sceneHeight;
        } else if (layout === "short") {
          panelFit = Math.min(width * 0.48 / 800, (sceneHeight - 100) / 470);
          stageY = 0.43;
        } else {
          panelFit = width < 1100 ? 0.65 : 0.85;
          stageY = 0.45;
        }
        element.style.setProperty("--panel-fit", String(panelFit));
        element.style.setProperty("--stage-y", `${stageY * 100}%`);
      };
      fitScene();
      const media = gsap.matchMedia(element);
      const sections = [...element.querySelectorAll< HTMLElement>(".service-chapter")];
      let scaleFrame = 0;
      const resize = new ResizeObserver(() => {
        cancelAnimationFrame(scaleFrame);
        scaleFrame = requestAnimationFrame(() => {
          sections.forEach((section) => {
            const width = section.querySelector< HTMLElement>(".stage")?.clientWidth ?? section.clientWidth;
            const scale = String(Math.min(1, width / 800));
            if (section.style.getPropertyValue("--panel-scale") !== scale) {
              section.style.setProperty("--panel-scale", scale);
            }
          });
        });
      });
      sections.forEach((section) => resize.observe(section.querySelector(".stage")!));

      media.add(
        {
          motion: "(prefers-reduced-motion: no-preference)",
        },
        (context) => {
          const animated = context.conditions?.motion;
          element.classList.toggle("simple", !animated);
          if (!animated) return;
          fitScene();

          const panels = [...element.querySelectorAll< HTMLElement>(".flow-panel")];
          const copies = [...element.querySelectorAll< HTMLElement>(".flow-copy")];
          const stages = [...element.querySelectorAll< HTMLElement>(".stage")];
          const nav = [...element.querySelectorAll< HTMLButtonElement>(".chapter-nav button")];
          const mid = (count - 1) / 2;
          const midIndex = Math.round(mid);

          // The stage moves by transform only; its CSS left/top stay the resting position.
          const stageAt = (left: number, top: number) => ({
            x: (_: number, el: HTMLElement) => scene.clientWidth * left - el.offsetLeft,
            y: (_: number, el: HTMLElement) => scene.clientHeight * top - el.offsetTop,
          });

          gsap.set(stages, { xPercent: -50, yPercent: -50, x: 0, y: 0 });
          gsap.set(panels, {
            xPercent: -50,
            yPercent: -50,
            transformPerspective: 1500,
            transformOrigin: "50% 50%",
          });
          panels.forEach((p, i) =>
            gsap.set(p, {
              x: layout === "desktop" ? 60 + (i - mid) * (scene.clientWidth < 1100 ? 120 : 230) : (i - mid) * Math.min(40, scene.clientWidth * 0.08),
              y: layout === "desktop" ? 35 + (i === midIndex ? -10 : 35) : (i === midIndex ? -6 : 10),
              z: -i * 100,
              rotationY: -32,
              rotationX: 12,
              rotationZ: -3,
              scale: layout === "desktop" ? (scene.clientWidth < 1100 ? 0.52 : 0.68) : panelFit * 0.8,
              autoAlpha: i === 0 ? 1 : 0.9,
              zIndex: count - i,
            }),
          );
          // Keep the fanned deck inside the viewport: pull the trailing cards in until the last one fits.
          for (let pass = 0; pass < 3 && count > 1; pass++) {
            const overflow =
              (panels[count - 1].getBoundingClientRect().right - viewport.getBoundingClientRect().right) + (layout === "desktop" ? 40 : 12);
            if (overflow <= 1) break;
            panels.forEach((p, i) => gsap.set(p, { x: `-=${(overflow * i) / (count - 1)}` }));
          }
          gsap.set(copies, { autoAlpha: 0, y: 20 });
          gsap.set(".flow-finale", { autoAlpha: 0, y: 30 });
          chapters.forEach((chapter, i) => {
            if (chapter.kind !== "build") return;
            const scenes = panels[i].querySelectorAll< HTMLElement>(".build-scene");
            gsap.set(scenes, { autoAlpha: 0, x: 35 });
            gsap.set(scenes[0], { autoAlpha: 1, x: 0 });
          });

          let ownedTrigger: ScrollTrigger | undefined;
          const tl = gsap.timeline({
            defaults: { ease: "power2.inOut" },
            onUpdate() {
              // Cache progress before resize changes the document's scroll range.
              // GSAP's revert pass must not replace it with a reset playhead.
              if (!rebuilding.current && element.clientWidth === fittedWidth && viewport.clientHeight === fittedHeight) {
                stableProgress.current = this.progress();
                stableActive.current = !!ownedTrigger?.isActive;
              }
              const time = this.time();
              const active =
                time < INTRO - 0.3 || time >= finaleAt
                  ? -1
                  : Math.min(count - 1, Math.max(0, Math.floor((time - INTRO) / CHAPTER)));
              position.current = time >= finaleAt ? count : active;
              nav.forEach((button, i) => {
                button.classList.toggle("active", i === active);
                if (i === active) button.setAttribute("aria-current", "step");
                else button.removeAttribute("aria-current");
              });
              copies.forEach((copy, i) => copy.setAttribute("aria-hidden", String(i !== active)));
            },
            scrollTrigger: {
              trigger: element.querySelector(".experience-section"),
              start: "top top",
              end: () =>
                `+=${Math.min(viewport.clientHeight * viewportsPerChapter, maxChapterScroll) * count}`,
              pin: viewport,
              scrub,
              invalidateOnRefresh: true,
            },
          });
          timeline.current = tl;
          ownedTrigger = tl.scrollTrigger;

          tl.to(".intro", { autoAlpha: 0, y: -40, duration: 0.65 }, 0).to(
            stages,
            { ...stageAt(layout === "phone" ? 0.5 : layout === "short" ? 0.75 : 0.67, stageY), duration: 1 },
            0,
          );

          chapters.forEach((chapter, i) => {
            const t = INTRO + i * CHAPTER;
            tl.addLabel(`flow-${i}`, t + 0.6);
            panels.forEach((panel, j) =>
              tl.to(
                panel,
                {
                  x: j === i ? 0 : j < i ? -580 : 530,
                  y: j === i ? 0 : 40,
                  z: j === i ? 50 : -500,
                  rotationY: j === i ? -8 : j < i ? 35 : -35,
                  rotationX: j === i ? 5 : 12,
                  rotationZ: 0,
                  scale: () => j === i ? panelFit : panelFit * 0.74,
                  autoAlpha: j === i ? 1 : 0,
                  zIndex: j === i ? 10 : 1,
                  duration: 1,
                },
                t - 0.7,
              ),
            );
            tl.to(copies[i], { autoAlpha: 1, y: 0, duration: 0.55 }, t);
            const items = copies[i].querySelectorAll("li");

            if (chapter.kind === "build") {
              const scenes = [...panels[i].querySelectorAll< HTMLElement>(".build-scene")];
              scenes.forEach((scene, j) => {
                const at = t + 0.35 + j * 1.08;
                if (j > 0)
                  tl.to(scenes[j - 1], { autoAlpha: 0, x: -35, duration: 0.35 }, at).to(
                    scene,
                    { autoAlpha: 1, x: 0, duration: 0.45 },
                    at + 0.1,
                  );
                if (items[j]) tl.to(items[j], { opacity: 1, duration: 0.3 }, at);
              });
            } else {
              tl.fromTo(
                panels[i].querySelector(".signal"),
                { strokeDashoffset: 0 },
                { strokeDashoffset: -290, duration: 3.4, ease: "none", immediateRender: false },
                t + 0.3,
              );
              chapter.steps.forEach((_, j) => {
                const at = t + 0.4 + j * 0.9;
                const faces = panels[i].querySelectorAll(`.node[data-step="${j}"] .node-face`);
                const glows = panels[i].querySelectorAll(`.node[data-step="${j}"] .node-glow`);
                if (!faces.length) return;
                tl.to(faces, { z: 45, y: -8, scale: 1.04, duration: 0.28 }, at)
                  .to(glows, { opacity: 1, duration: 0.28 }, at)
                  .to(faces, { z: 0, y: 0, scale: 1, duration: 0.25 }, at + 0.45)
                  .to(glows, { opacity: 0, duration: 0.25 }, at + 0.45);
                if (items[j]) tl.to(items[j], { opacity: 1, duration: 0.25 }, at);
              });
            }
            tl.to(copies[i], { autoAlpha: 0, y: -20, duration: 0.4 }, t + 3.8);
          });

          tl.to(stages, { ...stageAt(0.5, 0.48), duration: 1.1 }, finaleAt).to(
            ".chapter-nav,.scroll-hint",
            { autoAlpha: 0, duration: 0.5 },
            finaleAt,
          );
          panels.forEach((p, i) =>
            tl.to(
              p,
              {
                x: () => (i - mid) * Math.min(320, scene.clientWidth * 0.25),
                y: i === midIndex ? 145 : -95,
                z: -200,
                scale: () => layout === "desktop" ? 0.57 : panelFit * 0.8,
                rotationY: (i - mid) * -12,
                rotationX: 5,
                rotationZ: (i - mid) * 2,
                autoAlpha: 0.16,
                duration: 1.1,
              },
              finaleAt,
            ),
          );
          tl.to(".flow-finale", { autoAlpha: 1, y: 0, duration: 0.85 }, finaleAt + 0.55).to(
            {},
            { duration: FINALE_HOLD },
          );

          // Normal refreshes retain the cached playhead. Geometry changes rebuild
          // the complete timeline below, including its introductory fan poses.
          const trigger = tl.scrollTrigger!;
          let resumeProgress: number | null = null;
          const rememberProgress = () => {
            resumeProgress = !rebuilding.current && element.clientWidth === fittedWidth && viewport.clientHeight === fittedHeight && stableActive.current ? stableProgress.current : null;
          };
          const restoreProgress = () => {
            if (resumeProgress === null) return;
            const progress = resumeProgress;
            resumeProgress = null;
            window.scrollTo({
              top: trigger.start + progress * (trigger.end - trigger.start),
              behavior: "instant",
            });
          };
          ScrollTrigger.addEventListener("refreshInit", rememberProgress);
          ScrollTrigger.addEventListener("refresh", restoreProgress);

          return () => {
            element.classList.add("simple");
            ScrollTrigger.removeEventListener("refreshInit", rememberProgress);
            ScrollTrigger.removeEventListener("refresh", restoreProgress);
            timeline.current = null;
            copies.forEach((c) => c.removeAttribute("aria-hidden"));
            nav.forEach((n) => {
              n.classList.remove("active");
              n.removeAttribute("aria-current");
            });
          };
        },
      );

      let mounted = true;
      let rebuildTimer: ReturnType< typeof setTimeout> | undefined;
      const scheduleRebuild = () => {
        if (!mounted || element.classList.contains("simple")) return;
        if (!rebuilding.current) resizeProgress.current = stableActive.current ? stableProgress.current : null;
        rebuilding.current = true;
        clearTimeout(rebuildTimer);
        rebuildTimer = setTimeout(() => {
          if (mounted) setGeometryRevision(revision => revision + 1);
        }, 120);
      };
      const viewportResize = new ResizeObserver(() => {
        if (Math.abs(element.clientWidth - fittedWidth) > 1 || Math.abs(viewport.clientHeight - fittedHeight) > 1) scheduleRebuild();
      });
      // The root width changes even while ScrollTrigger pins the viewport at its
      // previous fixed width. Observe both to catch rotation without stale poses.
      viewportResize.observe(element);
      viewportResize.observe(viewport);

      // Safari can retain the pin's old element dimensions during rotation.
      // Browser viewport events provide a fallback while the existing rebuild
      // path preserves the playhead and recreates the same 3D poses.
      const browserResize = () => {
        if (Math.abs(window.innerWidth - fittedWindowWidth) > 1 || Math.abs(window.innerHeight - fittedWindowHeight) > 1) scheduleRebuild();
      };
      window.addEventListener("resize", browserResize);
      window.addEventListener("orientationchange", scheduleRebuild);
      window.visualViewport?.addEventListener("resize", browserResize);

      // A geometry rebuild keeps the exact playhead, including development scenes.
      // Prop changes retain the existing chapter navigation behavior.
      let frame = 0;
      if (resizeProgress.current !== null) {
        const progress = resizeProgress.current;
        resizeProgress.current = null;
        restorePosition.current = null;
        frame = requestAnimationFrame(() => {
          if (!mounted) return;
          ScrollTrigger.refresh();
          const tl = timeline.current;
          const trigger = tl?.scrollTrigger;
          if (tl && trigger) {
            trigger.scroll(trigger.start + progress * (trigger.end - trigger.start));
            tl.progress(progress);
            stableProgress.current = progress;
            stableActive.current = trigger.isActive;
          }
          rebuilding.current = false;
        });
      } else if (restorePosition.current !== null) {
        const at = restorePosition.current;
        restorePosition.current = null;
        frame = requestAnimationFrame(() => {
          if (!mounted) return;
          ScrollTrigger.refresh();
          scrollToPosition(at, "instant");
          rebuilding.current = false;
        });
      } else rebuilding.current = false;

      document.fonts.ready.then(() => {
        if (!mounted) return;
        if (Math.abs(copyBottom() - fittedCopyBottom) > 1) scheduleRebuild();
        else ScrollTrigger.refresh();
      });
      return () => {
        if (!rebuilding.current && timeline.current && restorePosition.current === null) restorePosition.current = position.current;
        mounted = false;
        clearTimeout(rebuildTimer);
        cancelAnimationFrame(frame);
        cancelAnimationFrame(scaleFrame);
        resize.disconnect();
        viewportResize.disconnect();
        window.removeEventListener("resize", browserResize);
        window.removeEventListener("orientationchange", scheduleRebuild);
        window.visualViewport?.removeEventListener("resize", browserResize);
        media.revert();
      };
    },
    { scope: root, dependencies: [content, viewportsPerChapter, maxChapterScroll, scrub, geometryRevision], revertOnUpdate: true },
  );



  if (!count) return null;
  return (
    <div ref={root} className={`af-experience simple ${className}`} style={{ ...(accent ? { "--color-hero-accent": accent } : {}), ...style } as CSSProperties}>
      <style dangerouslySetInnerHTML={{ __html: heroStyles + staticLayoutFix }} />
      <a className="skip" href={content.skip.target} onClick={() => {
        if (!content.skip.target.startsWith("#")) return;
        const target = document.getElementById(content.skip.target.slice(1));
        requestAnimationFrame(() => { target?.scrollIntoView({ behavior: "instant" }); target?.focus({ preventScroll: true }); });
      }}>
        {content.skip.label}
      </a>
      <section className="experience-section" id={instanceId} aria-label={content.ariaLabel}>
        <div className="viewport">
          <div className="scene">
          <div className="ambient" />
          <div className="intro">
            <p className="eyebrow">
              <span />
              {content.intro.eyebrow}
            </p>
            <h1>
              <RichLines text={content.intro.title} />
            </h1>
            <p className="intro-description">
              {content.intro.description.map((line, i) => (
                <Fragment key={i}>
                  {i > 0 && <br />}
                  {line}
                </Fragment>
              ))}
            </p>
            <button
              type="button"
              className="primary"
              disabled={introCtaDisabled}
              onClick={() => (onIntroCta ? onIntroCta() : scrollToPosition(0, "smooth"))}
            >
              {content.intro.cta} <span aria-hidden="true">{onIntroCta ? "→" : "↓"}</span>
            </button>
            {introExtra}
          </div>
          <div className="chapter-copy">
            {chapters.map((chapter, i) => (
              <section
                className="service-chapter"
                id={`${instanceId}-flow-${i}`}
                data-chapter={i}
                key={chapter.name}
                style={{ "--accent": chapter.color } as CSSProperties}
              >
                <article className="flow-copy">
                  <p className="eyebrow">{chapter.tag}</p>
                  <h2>
                    {chapter.title.map((line, j) => (
                      <span key={line}>
                        {j > 0 && <br />}
                        {line}
                      </span>
                    ))}
                  </h2>
                  <p className="flow-description">{chapter.description}</p>
                  <ol>
                    {chapter.steps.map((step, j) => (
                      <li key={step.title}>
                        <span aria-hidden="true">•</span>
                        <div>
                          <h3>{step.title}</h3>
                          <p>{step.body}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </article>
                <div className="stage" aria-hidden="true">
                  <div className="world">
                    <div
                      className={`flow-panel diagram-${i}${chapter.kind === "build" ? " development-panel" : ""}`}
                    >
                      {chapter.kind === "build" ? (
                        chapter.panel ?? <DevelopmentPanel chapter={chapter} />
                      ) : (
                        <WorkflowPanel chapter={chapter} />
                      )}
                    </div>
                  </div>
                </div>
              </section>
            ))}
          </div>
          <div className="flow-finale">
            <p className="eyebrow">{content.finale.eyebrow}</p>
            <h2>
              <RichLines text={content.finale.title} />
            </h2>
            {content.finale.cta && (
              <a className="primary" href={content.finale.cta.href}>
                {content.finale.cta.label} <span aria-hidden="true">↗</span>
              </a>
            )}
          </div>
          <nav className="chapter-nav" aria-label={content.navLabel}>
            {chapters.map((chapter, i) => (
              <button type="button" aria-controls={`${instanceId}-flow-${i}`} key={chapter.name} onClick={() => scrollToPosition(i, "smooth")}>
                {chapter.name}
                <i />
              </button>
            ))}
          </nav>
          <div className="experience-footer">
            <span className="demo-label">{content.footer.disclaimer}</span>
            <span className="scroll-hint">
              {content.footer.scrollHint} <b aria-hidden="true">↓</b>
            </span>
          </div>
          </div>
        </div>
      </section>
    </div>
  );
}
