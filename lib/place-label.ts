import type { PodiumPlaceDto } from "./api-types";

const ORDINAL_SUFFIXES: Record<number, string> = { 1: "st", 2: "nd", 3: "rd" };

/** `1st`, `2nd`, `3rd`; podium places never exceed 3. */
export function ordinal(place: number): string {
  return `${place}${ORDINAL_SUFFIXES[place] ?? "th"}`;
}

/**
 * Label for a podium group in sentence case: `3rd place`, or `Joint 2nd place`
 * when several nominees share it. Pass `lowercaseJoint` to embed in a sentence
 * (`Reveal joint 2nd place`).
 */
export function placeLabel(
  group: Pick<PodiumPlaceDto, "place" | "nominees">,
  lowercaseJoint = false
): string {
  const base = `${ordinal(group.place)} place`;
  if (group.nominees.length < 2) return base;
  return `${lowercaseJoint ? "joint" : "Joint"} ${base}`;
}
