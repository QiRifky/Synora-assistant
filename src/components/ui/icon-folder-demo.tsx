"use client";

import { IconFolder, DEFAULT_ICONS } from "@/components/ui/icon-folder";

const settings = { darkMode: false, iconCount: 4, spread: 70, startOpen: false, showPill: true };

export default function IconFolderDemo(props: Partial<typeof settings>) {
  const s = { ...settings, ...props };
  const icons = DEFAULT_ICONS.slice(0, Math.max(1, Math.min(DEFAULT_ICONS.length, Math.round(s.iconCount))));
  return <div className="flex w-full justify-center bg-background px-6 py-16"><IconFolder theme={s.darkMode ? "dark" : "light"} icons={icons} spread={s.spread} defaultOpen={s.startOpen} showPill={s.showPill} /></div>;
}