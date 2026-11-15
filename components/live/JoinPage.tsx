"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LiveGames } from "./LiveGames";
import { RejoinBanner } from "./RejoinBanner";
import { card, input, primary } from "./ui";

/** Join: type a game code, or pick a game that's open to everyone. */
export function JoinPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <RejoinBanner />
      <div className="text-center">
        <h1 className="font-display text-4xl font-extrabold tracking-tight">join a game 🎮</h1>
        <p className="mt-1 text-muted">got a code from the big screen? pop it in. no acount needed!!</p>
      </div>
      <JoinCodeForm code={code} setCode={setCode} onJoin={(c) => router.push(`/live/play/${c}`)} big />
      <p className="-mt-3 text-center text-sm text-muted">
        just wanna watch?{" "}
        <button type="button" disabled={!/^\d{6}$/.test(code)} onClick={() => router.push(`/live/watch/${code}`)} className="font-semibold text-accent underline disabled:no-underline disabled:opacity-50">
          👀 watch this game instead
        </button>
      </p>
      <section className="flex flex-col gap-3">
        <h2 className="font-display text-2xl font-bold">🌍 open to evryone</h2>
        <LiveGames embedded />
      </section>
    </div>
  );
}

/** The game code box (6 digits). */
export function JoinCodeForm({ code, setCode, onJoin, big = false }: { code: string; setCode: (c: string) => void; onJoin: (code: string) => void; big?: boolean }) {
  return (
    <form
      className={`${card} mx-auto flex w-full ${big ? "max-w-md" : ""} flex-col gap-3`}
      onSubmit={(e) => {
        e.preventDefault();
        if (/^\d{6}$/.test(code)) onJoin(code);
      }}
    >
      {!big && <h2 className="font-display text-xl font-bold">join a game 🎮</h2>}
      <input
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
        inputMode="numeric"
        autoComplete="off"
        placeholder="123456"
        aria-label="Game code"
        className={`${input} ${big ? "h-20 text-4xl" : "h-14 text-2xl"} text-center font-mono tracking-[0.4em] placeholder:text-muted/40`}
      />
      <button type="submit" disabled={code.length !== 6} className={`${primary} ${big ? "h-14 text-base" : ""}`}>
        Join
      </button>
      {!big && <p className="text-center text-xs text-muted">no acount needed to play :)</p>}
    </form>
  );
}
