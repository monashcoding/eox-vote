export const Stage = {
  Pending: "pending",
  Nominating: "nominating",
  Voting: "voting",
  Results: "results",
  Finished: "finished",
} as const;

export type Stage = (typeof Stage)[keyof typeof Stage];

export interface TimerDto {
  endsAt: number | null;
  remainingMs: number | null;
}

export interface PublicNomineeDto {
  id: string;
  firstName: string;
  lastName: string;
  photoUrl: string;
}

export interface PodiumPlaceDto {
  place: number;
  votes: number;
  nominees: PublicNomineeDto[];
}

export interface PublicResultsDto {
  totalSteps: number;
  revealed: PodiumPlaceDto[];
}

export interface PublicSessionDto {
  id: string;
  name: string;
  stage: Stage;
  timer: TimerDto;
  autoAdvance: boolean;
  nominees: PublicNomineeDto[];
  results: PublicResultsDto | null;
}

export interface PublicStateDto {
  serverNow: number;
  session: PublicSessionDto | null;
}

export interface MeDto {
  sessionId: string | null;
  nominations: PublicNomineeDto[];
  votes: string[];
}

export interface AdminSessionSummaryDto {
  id: string;
  name: string;
  stage: Stage;
  isCurrent: boolean;
  nomineeCount: number;
  voteCount: number;
  createdAt: number;
  startedAt: number | null;
  finishedAt: number | null;
}

export interface AdminNomineeDto extends PublicNomineeDto {
  votes: number;
  createdAt: number;
  updatedAt: number;
}

export interface AdminSessionDetailDto {
  id: string;
  name: string;
  stage: Stage;
  isCurrent: boolean;
  nominatingMinutes: number;
  votingMinutes: number;
  autoAdvance: boolean;
  timer: TimerDto;
  createdAt: number;
  startedAt: number | null;
  finishedAt: number | null;
  serverNow: number;
  nominees?: AdminNomineeDto[];
  revealedCount?: number;
  totalRevealSteps?: number;
  podium?: PodiumPlaceDto[];
}

export type ControlRequest =
  | {
      action:
        | "next"
        | "previous"
        | "pause"
        | "resume"
        | "clearTimer"
        | "revealNext"
        | "hideLast";
    }
  | { action: "adjustTimer"; deltaMs: number }
  | { action: "setTimer"; durationMs: number }
  | { action: "setTimer"; endsAt: number };
