// Remembers one layout per owner id (a chat, a document...) in localStorage,
// so leaving an owner and coming back finds its windows where they were,
// across restarts too. Oldest owners fall off past `max`.

import { normalize, type PaneLayout } from "./layout";

interface Entry<K extends string> {
  layout: PaneLayout<K>;
  at: number;
}

export interface LayoutStore<K extends string> {
  /** The owner's layout, repaired against `panels`; null when none is stored. */
  recall(ownerId: string, panels: readonly K[]): PaneLayout<K> | null;
  remember(ownerId: string, layout: PaneLayout<K>): void;
}

export function createLayoutStore<K extends string>(opts: { key: string; max?: number }): LayoutStore<K> {
  const max = opts.max ?? 60;
  const read = (): Record<string, Entry<K>> => {
    try {
      const raw = JSON.parse(localStorage.getItem(opts.key) ?? "{}");
      return raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
    } catch {
      return {};
    }
  };
  return {
    recall(ownerId, panels) {
      const hit = read()[ownerId];
      return hit ? normalize(hit.layout, panels) : null;
    },
    remember(ownerId, layout) {
      const store = read();
      store[ownerId] = { layout, at: Date.now() };
      const ids = Object.keys(store);
      if (ids.length > max) {
        ids
          .sort((a, b) => (store[a]?.at ?? 0) - (store[b]?.at ?? 0))
          .slice(0, ids.length - max)
          .forEach((id) => delete store[id]);
      }
      try {
        localStorage.setItem(opts.key, JSON.stringify(store));
      } catch {
        /* quota or disabled storage: the layout just won't be remembered */
      }
    },
  };
}
