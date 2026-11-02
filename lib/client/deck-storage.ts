const SEED_KEY = "eox:deck-seed";
const swipedKey = (sessionId: string) => `eox:swiped:${sessionId}`;

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage unavailable (private mode, quota): the deck still works for this visit.
  }
}

/** Per-device random seed, created on first use and kept in localStorage. */
export function getDeckSeed(): string {
  const existing = readStorage(SEED_KEY);
  if (existing) return existing;
  const seed = Math.random().toString(36).slice(2) + Date.now().toString(36);
  writeStorage(SEED_KEY, seed);
  return seed;
}

/** FNV-1a, 32 bit. */
function hash32(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Orders items by a seeded hash of their id. The order is stable for a device
 * and unaffected by entries being added or removed.
 */
export function shuffleBySeed<T extends { id: string }>(
  items: readonly T[],
  seed: string
): T[] {
  return items
    .map((item) => ({ item, key: hash32(`${seed}:${item.id}`) }))
    .sort((a, b) => a.key - b.key || a.item.id.localeCompare(b.item.id))
    .map((entry) => entry.item);
}

export function loadSwipedIds(sessionId: string): string[] {
  const raw = readStorage(swipedKey(sessionId));
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}

export function saveSwipedIds(sessionId: string, ids: readonly string[]): void {
  writeStorage(swipedKey(sessionId), JSON.stringify(ids));
}
