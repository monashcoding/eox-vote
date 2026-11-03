/** Lower case without accents, so "Zoë" and "zoe" compare equal. */
function fold(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

/**
 * True when every word of `query` appears somewhere in the full name, in any
 * order: "ada" and "love ada" both match Ada Lovelace. An empty query matches.
 */
export function matchesNameQuery(
  firstName: string,
  lastName: string,
  query: string
): boolean {
  const name = fold(`${firstName} ${lastName}`);
  return fold(query)
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => name.includes(word));
}
