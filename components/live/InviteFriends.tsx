"use client";

import { useEffect, useRef, useState } from "react";
import { FriendInvites } from "@/components/room/FriendInvites";

/** "📨 Invite friends": ur Jace Social friends, each with an invite button (they get a DM with the join link). */
export function InviteFriends({ code, className = "" }: { code: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("pointerdown", away);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("pointerdown", away);
      window.removeEventListener("keydown", esc);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} title="Invite ur Jace Social friends" className={className}>
        📨 Invite friends
      </button>
      {open && (
        <div className="jl-pop-in absolute right-0 top-12 z-50 w-[min(92vw,24rem)] text-left shadow-xl">
          <FriendInvites code={code} gameName="Jace Live" inRoom={[]} endpoint={`/api/live/games/${code}/invite`} />
        </div>
      )}
    </div>
  );
}
