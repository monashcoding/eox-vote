import { Stage } from "../api-types.ts";
import type {
  CategoryPodiumDto,
  PodiumPlaceDto,
  PublicNomineeDto,
  PublicResultsDto,
} from "../api-types.ts";

/** Highest place that is part of the podium. */
export const PODIUM_PLACES = 3;

/** A nominee together with its derived vote count. Extra fields are never copied out. */
export type RankableNominee = PublicNomineeDto & { votes: number };

/** A nominee with its votes per category id; a missing category means no votes. */
export type CategoryRankableNominee = PublicNomineeDto & {
  votesByCategory: Readonly<Record<string, number>>;
};

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

/**
 * Each category's podium, in the order the categories are given. Every
 * nominee is ranked in every category on that category's votes alone.
 */
export function buildCategoryPodiums(
  categories: readonly { id: string }[],
  nominees: readonly CategoryRankableNominee[]
): CategoryPodiumDto[] {
  return categories.map((category) => ({
    categoryId: category.id,
    places: buildPodium(
      nominees.map((nominee) => ({
        id: nominee.id,
        firstName: nominee.firstName,
        lastName: nominee.lastName,
        photoUrl: nominee.photoUrl,
        votes: nominee.votesByCategory[category.id] ?? 0,
      }))
    ),
  }));
}

/** One place in reveal order, with the category it belongs to. */
export interface RevealStep {
  categoryId: string;
  place: PodiumPlaceDto;
}

/**
 * The order places are revealed in: category by category, each from its
 * lowest place up to 1st. A session's reveal counter counts along this list.
 */
export function revealSteps(podiums: readonly CategoryPodiumDto[]): RevealStep[] {
  return podiums.flatMap((podium) =>
    podium.places
      .toReversed()
      .map((place) => ({ categoryId: podium.categoryId, place }))
  );
}

/** Clamps a stored reveal counter to the steps that exist. */
export function clampRevealed(revealedCount: number, total: number): number {
  return Math.max(0, Math.min(revealedCount, total));
}

/**
 * What attendees may see: the first `revealedCount` reveal steps while in
 * `results`, every step once `finished`, and nothing in any other stage.
 * Every category reports its own total, so attendees can tell what is to come.
 */
export function publicResults(
  stage: Stage,
  podiums: readonly CategoryPodiumDto[],
  revealedCount: number
): PublicResultsDto | null {
  if (stage !== Stage.Results && stage !== Stage.Finished) return null;
  const total = revealSteps(podiums).length;
  let remaining =
    stage === Stage.Finished ? total : clampRevealed(revealedCount, total);
  return {
    categories: podiums.map((podium) => {
      // Reveal steps go lowest place first.
      const steps = podium.places.toReversed();
      const shown = Math.min(remaining, steps.length);
      remaining -= shown;
      return {
        categoryId: podium.categoryId,
        totalSteps: steps.length,
        revealed: steps.slice(0, shown),
      };
    }),
  };
}
