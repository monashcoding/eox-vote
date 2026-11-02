"use client";

import * as React from "react";
import { Stage, TimerDto } from "@/lib/api-types";

export type CountdownStatus = "running" | "paused" | "expired" | "none";

export interface CountdownState {
  status: CountdownStatus;
  statusLabel: "Running" | "Paused" | "Time is up" | "No timer";
  remainingMs: number | null;
  formatted: string;
  isExpired: boolean;
  isPaused: boolean;
  isRunning: boolean;
  hasTimer: boolean;
}

export function formatMs(ms: number | null): string {
  if (ms === null || ms < 0) return "";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function formatCountdownCopy(
  stage: Stage,
  countdown: CountdownState
): string | null {
  if (!countdown.hasTimer) {
    return null;
  }
  if (countdown.isPaused) {
    return `Timer paused at ${countdown.formatted}`;
  }
  if (countdown.isExpired) {
    return "Time is up. Waiting for the host.";
  }
  if (stage === Stage.Nominating) {
    return `Nominations close in ${countdown.formatted}`;
  }
  if (stage === Stage.Voting) {
    return `Voting closes in ${countdown.formatted}`;
  }
  return `Closes in ${countdown.formatted}`;
}

// Global clock store to avoid impure Date.now() during render and setState-in-effect
type ClockListener = () => void;

class ClockStore {
  private listeners = new Set<ClockListener>();
  private intervalId: NodeJS.Timeout | null = null;
  private currentNow: number = 0;
  private serverOffset: number = 0;
  private lastServerNow: number | null = null;
  constructor() {
    if (typeof window !== "undefined") {
      this.currentNow = Date.now();
    }
  }

  updateServerTime(serverNow: number | null | undefined): void {
    if (serverNow === null || serverNow === undefined) return;
    if (this.lastServerNow === serverNow) return;
    this.lastServerNow = serverNow;
    const clientNow = Date.now();
    this.currentNow = clientNow;
    this.serverOffset = serverNow - clientNow;
    this.notify();
  }

  private snapshot: { now: number; offset: number } = { now: 0, offset: 0 };
  private readonly serverSnapshot = { now: 0, offset: 0 };

  // useSyncExternalStore needs referentially stable snapshots between changes.
  private refreshSnapshot(): void {
    this.snapshot = { now: this.currentNow, offset: this.serverOffset };
  }

  getSnapshot = (): { now: number; offset: number } => this.snapshot;

  getServerSnapshot = (): { now: number; offset: number } =>
    this.serverSnapshot;

  subscribe = (listener: ClockListener): (() => void) => {
    this.listeners.add(listener);
    if (this.listeners.size === 1) {
      this.currentNow = Date.now();
      this.refreshSnapshot();
      this.intervalId = setInterval(() => {
        this.currentNow = Date.now();
        this.notify();
      }, 250);
    }
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0 && this.intervalId) {
        clearInterval(this.intervalId);
        this.intervalId = null;
      }
    };
  };

  private notify(): void {
    this.refreshSnapshot();
    for (const listener of this.listeners) {
      listener();
    }
  }
}

const clock = new ClockStore();

export function useCountdown(
  timer: TimerDto | null | undefined,
  serverNow: number | null | undefined
): CountdownState {
  React.useEffect(() => {
    clock.updateServerTime(serverNow);
  }, [serverNow]);

  const clockState = React.useSyncExternalStore(
    clock.subscribe,
    clock.getSnapshot,
    clock.getServerSnapshot
  );

  const endsAt = timer?.endsAt ?? null;
  const remainingMsProp = timer?.remainingMs ?? null;

  if (!timer || (endsAt === null && remainingMsProp === null)) {
    return {
      status: "none",
      statusLabel: "No timer",
      remainingMs: null,
      formatted: "",
      isExpired: false,
      isPaused: false,
      isRunning: false,
      hasTimer: false,
    };
  }

  if (remainingMsProp !== null) {
    const remainingMs = Math.max(0, remainingMsProp);
    const isExpired = remainingMs <= 0;
    return {
      status: isExpired ? "expired" : "paused",
      statusLabel: isExpired ? "Time is up" : "Paused",
      remainingMs,
      formatted: formatMs(remainingMs),
      isExpired,
      isPaused: !isExpired,
      isRunning: false,
      hasTimer: true,
    };
  }

  if (endsAt !== null) {
    // If not hydrated yet on client (server snapshot), show placeholder or endsAt difference
    const currentServerTime =
      clockState.now > 0 ? clockState.now + clockState.offset : (serverNow ?? 0);
    const remainingMs =
      currentServerTime > 0 ? Math.max(0, endsAt - currentServerTime) : null;
    const isExpired = remainingMs !== null && remainingMs <= 0;

    return {
      status: isExpired ? "expired" : "running",
      statusLabel: isExpired ? "Time is up" : "Running",
      remainingMs,
      formatted:
        isExpired
          ? "00:00"
          : remainingMs !== null
            ? formatMs(remainingMs)
            : "",
      isExpired,
      isPaused: false,
      isRunning: !isExpired,
      hasTimer: true,
    };
  }

  return {
    status: "none",
    statusLabel: "No timer",
    remainingMs: null,
    formatted: "",
    isExpired: false,
    isPaused: false,
    isRunning: false,
    hasTimer: false,
  };
}
