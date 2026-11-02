import * as React from "react";

export function usePolling(
  callback: () => Promise<void> | void,
  intervalMs: number,
  enabled: boolean = true
): void {
  const savedCallback = React.useRef(callback);

  React.useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  React.useEffect(() => {
    if (!enabled) return;

    let isSubscribed = true;
    let running = false;
    let timerId: NodeJS.Timeout | undefined;

    // One request at a time: the next tick is scheduled only after the
    // previous one settles, so a slow response can never land after a newer
    // one and roll the view back.
    const tick = async () => {
      if (running || !isSubscribed) return;
      clearTimeout(timerId);
      running = true;
      try {
        if (!document.hidden) await savedCallback.current();
      } catch (err) {
        console.error("Polling error:", err);
      } finally {
        running = false;
        if (isSubscribed) {
          timerId = setTimeout(() => void tick(), intervalMs);
        }
      }
    };

    void tick();

    const handleVisibilityChange = () => {
      if (!document.hidden) void tick();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isSubscribed = false;
      clearTimeout(timerId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [intervalMs, enabled]);
}
