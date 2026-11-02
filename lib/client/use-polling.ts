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
    let timerId: NodeJS.Timeout | null = null;

    const tick = async () => {
      if (document.hidden) return;
      try {
        await savedCallback.current();
      } catch (err) {
        console.error("Polling error:", err);
      }
    };

    // Initial fetch
    void tick();

    timerId = setInterval(() => {
      void tick();
    }, intervalMs);

    const handleVisibilityChange = () => {
      if (!document.hidden && isSubscribed) {
        void tick();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isSubscribed = false;
      clearInterval(timerId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [intervalMs, enabled]);
}
