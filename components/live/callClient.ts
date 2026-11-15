"use client";

import { openRoomChannel } from "@/lib/realtime/client";

/**
 * The voice call on this device (one at a time). It lives outside the page's
 * components, so the call keeps going when the screen changes (lobby → game).
 * You join muted; only friends the server lets through ever connect; leaving
 * stops the microphone.
 */

type Room = "game" | "team";
type Peer = { id: string; name: string };
export type CallUi = {
  code: string | null;
  room: Room | null;
  joining: boolean;
  muted: boolean;
  peers: (Peer & { connected: boolean })[];
  notFriends: number;
  error: string | null;
};

let ui: CallUi = { code: null, room: null, joining: false, muted: true, peers: [], notFriends: 0, error: null };
const subs = new Set<() => void>();
const set = (patch: Partial<CallUi>) => {
  ui = { ...ui, ...patch };
  subs.forEach((f) => f());
};
export const callSubscribe = (f: () => void) => {
  subs.add(f);
  return () => void subs.delete(f);
};
export const callSnapshot = () => ui;

let me = "";
let mic: MediaStream | null = null;
let ice: RTCIceServer[] = [];
let timer: ReturnType<typeof setInterval> | null = null;
let channel: { close: () => void } | null = null;
const pcs = new Map<string, RTCPeerConnection>();
const audios = new Map<string, HTMLAudioElement>();
let names = new Map<string, string>();

const api = (code: string, body?: object) =>
  fetch(`/api/live/games/${code}/call${body ? "" : "?beat=1"}`, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : { cache: "no-store" }).then(async (r) => {
    const d = await r.json().catch(() => null);
    if (!r.ok) throw new Error(d?.error ?? "Calls aren't working right now.");
    return d;
  });

/** The full connection details, once the device has gathered them (no trickle), or after 3 s. */
async function described(pc: RTCPeerConnection): Promise<string> {
  if (pc.iceGatheringState !== "complete") {
    await new Promise<void>((resolve) => {
      const t = setTimeout(resolve, 3000);
      pc.addEventListener("icegatheringstatechange", () => {
        if (pc.iceGatheringState === "complete") {
          clearTimeout(t);
          resolve();
        }
      });
    });
  }
  return pc.localDescription?.sdp ?? "";
}

function close(id: string) {
  pcs.get(id)?.close();
  pcs.delete(id);
  const a = audios.get(id);
  if (a) {
    a.srcObject = null;
    a.remove();
  }
  audios.delete(id);
}

function connectionFor(id: string): RTCPeerConnection {
  close(id);
  const pc = new RTCPeerConnection({ iceServers: ice });
  mic?.getTracks().forEach((t) => pc.addTrack(t, mic!));
  pc.ontrack = (e) => {
    let a = audios.get(id);
    if (!a) {
      a = document.createElement("audio");
      a.autoplay = true;
      a.style.display = "none";
      document.body.appendChild(a);
      audios.set(id, a);
    }
    a.srcObject = e.streams[0] ?? new MediaStream([e.track]);
    void a.play().catch(() => {});
  };
  pc.onconnectionstatechange = () => {
    if (pc.connectionState === "failed" || pc.connectionState === "closed") close(id);
    refreshPeers();
  };
  pcs.set(id, pc);
  return pc;
}

function refreshPeers() {
  set({ peers: ui.peers.map((p) => ({ ...p, connected: pcs.get(p.id)?.connectionState === "connected" })) });
}

async function offerTo(code: string, peer: Peer) {
  const pc = connectionFor(peer.id);
  await pc.setLocalDescription(await pc.createOffer());
  const sdp = await described(pc);
  await api(code, { action: "signal", to: peer.id, kind: "offer", sdp }).catch(() => close(peer.id));
}

/** Matches the connections to the friends in the call: the one with the smaller id calls the other. */
function reconcile(code: string, peers: Peer[]) {
  names = new Map(peers.map((p) => [p.id, p.name]));
  for (const id of [...pcs.keys()]) if (!names.has(id)) close(id);
  for (const p of peers) if (!pcs.has(p.id) && me < p.id) void offerTo(code, p);
  set({ peers: peers.map((p) => ({ ...p, connected: pcs.get(p.id)?.connectionState === "connected" })) });
}

async function onSignal(code: string, m: { from: string; kind: string; sdp: string | null }) {
  if (m.kind === "bye") {
    close(m.from);
    refreshPeers();
    return;
  }
  if (m.kind === "offer" && m.sdp) {
    const pc = connectionFor(m.from);
    await pc.setRemoteDescription({ type: "offer", sdp: m.sdp });
    await pc.setLocalDescription(await pc.createAnswer());
    const sdp = await described(pc);
    await api(code, { action: "signal", to: m.from, kind: "answer", sdp }).catch(() => close(m.from));
  } else if (m.kind === "answer" && m.sdp) {
    const pc = pcs.get(m.from);
    if (pc && pc.signalingState === "have-local-offer") await pc.setRemoteDescription({ type: "answer", sdp: m.sdp }).catch(() => close(m.from));
  }
}

export async function joinCall(code: string, room: Room) {
  if (ui.room || ui.joining) await leaveCall();
  set({ code, joining: true, error: null });
  try {
    mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    // Everyone joins muted: nobody hears u until u unmute.
    mic.getAudioTracks().forEach((t) => (t.enabled = false));
    ice = ((await fetch(`/api/live/games/${code}/call/ice`).then((r) => r.json())).iceServers ?? []) as RTCIceServer[];
    const st = await api(code, { action: "join", room });
    me = st.me;
    const ch = openRoomChannel(st.topic, null);
    const off = ch.on("call-signal", (p) => void onSignal(code, p as { from: string; kind: string; sdp: string | null }));
    channel = {
      close: () => {
        off();
        ch.close();
      },
    };
    set({ room: st.mine, joining: false, muted: true, notFriends: st.inCallNotFriends });
    reconcile(code, st.peers);
    // Check in every few seconds (staying in the call) and pick up who joined or left.
    timer = setInterval(() => {
      api(code)
        .then((s) => {
          if (!s.mine) return void leaveCall();
          set({ notFriends: s.inCallNotFriends });
          reconcile(code, s.peers);
        })
        .catch(() => {});
    }, 4000);
  } catch (e) {
    await leaveCall(false);
    const msg = e instanceof Error ? e.message : "";
    set({ error: /Permission|NotAllowed|denied/i.test(msg) ? "u need to let the site use ur mic to join." : msg || "Couldn't join the call." });
  }
}

export async function leaveCall(tellServer = true) {
  const code = ui.code;
  if (timer) clearInterval(timer);
  timer = null;
  if (code && tellServer) for (const id of pcs.keys()) void api(code, { action: "signal", to: id, kind: "bye" }).catch(() => {});
  for (const id of [...pcs.keys()]) close(id);
  channel?.close();
  channel = null;
  mic?.getTracks().forEach((t) => t.stop());
  mic = null;
  if (code && tellServer && ui.room) await api(code, { action: "leave" }).catch(() => {});
  set({ room: null, joining: false, muted: true, peers: [], notFriends: 0 });
}

export function setMuted(muted: boolean) {
  mic?.getAudioTracks().forEach((t) => (t.enabled = !muted));
  set({ muted });
}
