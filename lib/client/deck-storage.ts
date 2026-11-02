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

/** mulberry32: small seeded PRNG returning floats in [0, 1). */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Seeded Fisher-Yates shuffle: every order is equally likely across seeds and
 * the order is stable for a device. Items are sorted by id first, so the
 * result depends only on the seed and the set of ids, not on input order.
 */
export function shuffleBySeed<T extends { id: string }>(
  items: readonly T[],
  seed: string
): T[] {
  const result = [...items].sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  );
  const random = mulberry32(hash32(seed));
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
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
