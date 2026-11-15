"use client";

import { useEffect } from "react";
import { useScores } from "@/components/ScoresProvider";

/** Once a day (signed in): counts ur daily streak and cheers if it went up. */
export function StreakCheck() {
  const { user } = useScores();
  useEffect(() => {
    if (!user) return;
    const today = new Date().toISOString().slice(0, 10);
    const key = `jace-live:streak-day:${user.id}`;
    try {
      if (localStorage.getItem(key) === today) return;
      localStorage.setItem(key, today);
    } catch {}
    fetch("/api/me/streak", { method: "POST" })
      .then((r) => r.json())
      .then((d) => {
        if (!d?.isNew) return;
        const shout = d.streak > 1 ? `🔥 ${d.streak}-day streak!! +${d.xp} XP` : `☀️ day 1 of ur streak! +${d.xp} XP (come back tmrw!)`;
        window.dispatchEvent(new CustomEvent("jl-egg", { detail: { shout, big: d.streak >= 3, party: d.streak >= 3 ? ["🔥", "⭐", "🎉"] : undefined } }));
      })
      .catch(() => {});
  }, [user]);
  return null;
}
