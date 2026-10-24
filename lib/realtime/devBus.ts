import "server-only";

/**
 * Development-only stand-in for Supabase Realtime: an in-process pub/sub that
 * app/api/dev/realtime streams to browsers over Server-Sent Events, with
 * simple presence. Only used when Supabase isn't configured and never in
 * production.
 */

type Listener = (msg: { event: string; payload: unknown }) => void;
type Bus = {
  publish(topic: string, event: string, payload: unknown): void;
  subscribe(topic: string, member: { key: string; meta: unknown } | null, fn: Listener): () => void;
};

const g = globalThis as unknown as { __jgBus?: Bus };

export function devBus(): Bus {
  if (g.__jgBus) return g.__jgBus;
  const listeners = new Map<string, Set<Listener>>();
  const members = new Map<string, Map<string, { meta: unknown; count: number }>>();

  const publish = (topic: string, event: string, payload: unknown) => {
    for (const fn of listeners.get(topic) ?? []) fn({ event, payload });
  };
  const presence = (topic: string) => {
    const list = [...(members.get(topic) ?? new Map()).entries()].map(([key, v]) => ({ key, meta: v.meta }));
    publish(topic, "__presence", list);
  };

  g.__jgBus = {
    publish,
    subscribe(topic, member, fn) {
      if (!listeners.has(topic)) listeners.set(topic, new Set());
      listeners.get(topic)!.add(fn);
      if (member) {
        if (!members.has(topic)) members.set(topic, new Map());
        const m = members.get(topic)!;
        const cur = m.get(member.key);
        m.set(member.key, { meta: member.meta, count: (cur?.count ?? 0) + 1 });
        setTimeout(() => presence(topic), 0);
      }
      return () => {
        listeners.get(topic)?.delete(fn);
        if (member) {
          const m = members.get(topic);
          const cur = m?.get(member.key);
          if (cur && cur.count > 1) cur.count--;
          else m?.delete(member.key);
          presence(topic);
        }
      };
    },
  };
  return g.__jgBus;
}
