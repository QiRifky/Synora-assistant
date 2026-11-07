import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { MenuToggleIcon } from "@/components/ui/menu-toggle-icon";
import { useScroll } from "@/components/ui/use-scroll";
import { cn } from "@/lib/utils";
import { waitCountdown } from "@/lib/rate-limit";

const links = [
  { label: "How it works", href: "#how-it-works" },
  { label: "Channels", href: "#channels" },
  { label: "Features", href: "#features" },
];

export function Header({ onSignIn, remaining = 0 }: { onSignIn: () => void; remaining?: number }) {
  const [open, setOpen] = useState(false);
  const scrolled = useScroll(10);
  const waiting = remaining > 0;

  useEffect(() => {
    const query = window.matchMedia("(min-width: 768px)");
    const closeOnDesktop = () => { if (query.matches) setOpen(false); };
    query.addEventListener("change", closeOnDesktop);
    return () => query.removeEventListener("change", closeOnDesktop);
  }, []);

  const signIn = () => {
    if (waiting) return;
    setOpen(false);
    onSignIn();
  };

  return (
    <header className={cn("sticky top-0 z-50 w-full border-b border-border bg-background text-foreground", scrolled && "bg-background/95 backdrop-blur-lg supports-[backdrop-filter]:bg-background/80")}>
      <nav aria-label="Main navigation" className="landing-container flex h-14 items-center justify-between gap-3">
        <a href="#top" aria-label="Synora home" className="rounded-md font-display text-2xl text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Synora</a>
        <div className="hidden items-center gap-1 md:flex">
          {links.map(link => <a key={link.label} className={buttonVariants({ variant: "ghost" })} href={link.href}>{link.label}</a>)}
          <div className="ml-3 flex items-center gap-2">
            <Button className="landing-btn" disabled={waiting} onClick={signIn}>Sign in with Buffer</Button>
            {waiting && <span role="timer" className="text-xs text-muted-foreground">{waitCountdown(remaining)}</span>}
          </div>
        </div>
        <Dialog.Root open={open} onOpenChange={setOpen}>
          <Dialog.Trigger asChild>
            <Button size="icon" variant="outline" className="md:hidden" aria-label="Open menu"><MenuToggleIcon open={open} /></Button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="landing fixed inset-0 z-50 bg-background/95 backdrop-blur-lg" />
            <Dialog.Content aria-describedby={undefined} className="landing fixed inset-0 z-50 flex flex-col overflow-y-auto bg-background text-foreground md:hidden">
              <div className="landing-container flex h-14 shrink-0 items-center justify-between">
                <Dialog.Title className="font-display text-2xl text-foreground">Synora</Dialog.Title>
                <Dialog.Close asChild><Button size="icon" variant="outline" aria-label="Close menu"><MenuToggleIcon open /></Button></Dialog.Close>
              </div>
              <nav aria-label="Mobile navigation" className="flex flex-1 flex-col gap-3 border-t border-border p-6">
                {links.map(link => <Dialog.Close asChild key={link.label}><a className={buttonVariants({ variant: "ghost", className: "justify-start" })} href={link.href}>{link.label}</a></Dialog.Close>)}
                <Button className="landing-btn mt-5 w-full" disabled={waiting} onClick={signIn}>Sign in with Buffer</Button>
                {waiting && <p role="timer" className="text-center text-xs text-muted-foreground">Sign-in available in {waitCountdown(remaining)}</p>}
              </nav>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </nav>
    </header>
  );
}