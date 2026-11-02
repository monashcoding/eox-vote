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

export const ControlAction = {
  Next: "next",
  Previous: "previous",
  Pause: "pause",
  Resume: "resume",
  ClearTimer: "clearTimer",
  AdjustTimer: "adjustTimer",
  SetTimer: "setTimer",
} as const;

export type ControlAction = (typeof ControlAction)[keyof typeof ControlAction];

export type SimpleControlAction =
  | typeof ControlAction.Next
  | typeof ControlAction.Previous
  | typeof ControlAction.Pause
  | typeof ControlAction.Resume
  | typeof ControlAction.ClearTimer;

export type ControlRequest =
  | { action: SimpleControlAction }
  | { action: typeof ControlAction.AdjustTimer; deltaMs: number }
  | { action: typeof ControlAction.SetTimer; durationMs: number }
  | { action: typeof ControlAction.SetTimer; endsAt: number };
