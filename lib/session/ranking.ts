import { Stage } from "../api-types.ts";
import type {
  PodiumPlaceDto,
  PublicNomineeDto,
  PublicResultsDto,
} from "../api-types.ts";

/** Highest place that is part of the podium. */
export const PODIUM_PLACES = 3;

/** A nominee together with its derived vote count. Extra fields are never copied out. */
export type RankableNominee = PublicNomineeDto & { votes: number };

/**
 * Podium for a set of nominees, first place first.
 *
 * Only nominees with at least one vote are ranked. Standard competition
 * ranking by votes (ties share a place: 1, 2, 2, 4). Places above
 * `PODIUM_PLACES` are dropped and nominees sharing a place are grouped, in
 * input order. Each group is one reveal step.
 */
export function buildPodium(nominees: readonly RankableNominee[]): PodiumPlaceDto[] {
  const ranked = nominees
    .filter((n) => n.votes >= 1)
    .toSorted((a, b) => b.votes - a.votes);

  const podium: PodiumPlaceDto[] = [];
  let place = 0;
  for (const [index, nominee] of ranked.entries()) {
    const group = podium.at(-1);
    if (group && group.votes === nominee.votes) {
      group.nominees.push(toPublicNominee(nominee));
      continue;
    }
    place = index + 1;
    if (place > PODIUM_PLACES) break;
    podium.push({
      place,
      votes: nominee.votes,
      nominees: [toPublicNominee(nominee)],
    });
  }
  return podium;
}

function toPublicNominee(nominee: RankableNominee): PublicNomineeDto {
  return {
    id: nominee.id,
    firstName: nominee.firstName,
    lastName: nominee.lastName,
    photoUrl: nominee.photoUrl,
  };
}

/** Clamps a stored reveal counter to the steps that exist. */
export function clampRevealed(revealedCount: number, total: number): number {
  return Math.max(0, Math.min(revealedCount, total));
}

/**
 * What attendees may see: the first `revealedCount` steps while in `results`,
 * every step once `finished`, and nothing in any other stage.
 */
export function publicResults(
  stage: Stage,
  podium: readonly PodiumPlaceDto[],
  revealedCount: number
): PublicResultsDto | null {
  if (stage !== Stage.Results && stage !== Stage.Finished) return null;
  // Reveal steps go lowest place first.
  const steps = podium.toReversed();
  const visible =
    stage === Stage.Finished ? steps.length : clampRevealed(revealedCount, steps.length);
  return { totalSteps: steps.length, revealed: steps.slice(0, visible) };
}
