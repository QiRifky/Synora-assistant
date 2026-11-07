import { useEffect, useState } from "react";
import { remainingWaitSeconds } from "@/lib/rate-limit";

const STORAGE_KEY = "synora:sign-in-cooldown";

export function useSignInCooldown(active: boolean, retryMinutes?: number) {
  // When Buffer gives no timing hint, use a short local cooldown.
  const duration = (retryMinutes ?? 1) * 60;
  const [remaining, setRemaining] = useState(active ? Math.ceil(duration) : 0);

  useEffect(() => {
    if (!active) { setRemaining(0); return; }
    let deadline = Date.now() + duration * 1000;
    try {
      const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "null");
      if (saved?.duration === duration && typeof saved.deadline === "number" && Number.isFinite(saved.deadline)) {
        deadline = saved.deadline;
      } else {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ duration, deadline }));
      }
    } catch { /* Storage may be blocked; the in-memory countdown still works. */ }
    const tick = () => setRemaining(remainingWaitSeconds(deadline));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [active, duration]);

  const startSignIn = () => {
    if (remaining > 0) return;
    try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* Optional storage. */ }
    window.location.assign("/api/public/buffer/start");
  };

  return { remaining, startSignIn };
}