"use client";

import { useSyncExternalStore } from "react";

/**
 * Turning chat or voice calls off for urself: in one game (this device, while
 * it lasts) or in every game (saved to ur account, see ThemeContext's
 * pushPrefs). Account-wide off always wins.
 */

export const NO_CHAT_KEY = "jace-live:no-chat";
export const NO_CALLS_KEY = "jace-live:no-calls";
const gameKey = (code: string) => `jace-live:game-off:${code}`;

const subs = new Set<() => void>();
export const notifyPrivacy = () => subs.forEach((f) => f());
const subscribe = (f: () => void) => {
  subs.add(f);
  window.addEventListener("storage", f);
  return () => {
    subs.delete(f);
    window.removeEventListener("storage", f);
  };
};

const read = (k: string) => {
  try {
    return localStorage.getItem(k) === "1";
  } catch {
    return false;
  }
};
type GameOff = { chat: boolean; calls: boolean };
const readGame = (code: string): string => {
  try {
    return sessionStorage.getItem(gameKey(code)) ?? "";
  } catch {
    return "";
  }
};
const parseGame = (raw: string): GameOff => {
  try {
    const v = JSON.parse(raw || "{}") as Partial<GameOff>;
    return { chat: v.chat === true, calls: v.calls === true };
  } catch {
    return { chat: false, calls: false };
  }
};

/** Account-wide: no chat / no calls in any game. */
export function useAccountOff(): { chat: boolean; calls: boolean } {
  const chat = useSyncExternalStore(subscribe, () => read(NO_CHAT_KEY), () => false);
  const calls = useSyncExternalStore(subscribe, () => read(NO_CALLS_KEY), () => false);
  return { chat, calls };
}

/** Saves account-wide off (and syncs it to ur account). */
export function setAccountOff(kind: "chat" | "calls", off: boolean, push: () => void) {
  try {
    localStorage.setItem(kind === "chat" ? NO_CHAT_KEY : NO_CALLS_KEY, off ? "1" : "0");
  } catch {}
  notifyPrivacy();
  push();
}

/** In this game: chat / calls off for me (account-wide off counts too). `locked` = off for the whole account. */
export function useGameOff(code: string): { chat: boolean; calls: boolean; locked: { chat: boolean; calls: boolean } } {
  const account = useAccountOff();
  const raw = useSyncExternalStore(subscribe, () => readGame(code), () => "");
  const g = parseGame(raw);
  return { chat: g.chat || account.chat, calls: g.calls || account.calls, locked: account };
}

export function setGameOff(code: string, kind: "chat" | "calls", off: boolean) {
  const g = parseGame(readGame(code));
  g[kind] = off;
  try {
    sessionStorage.setItem(gameKey(code), JSON.stringify(g));
  } catch {}
  notifyPrivacy();
}
