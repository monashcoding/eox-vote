import { PHASE_PRODUCTION_BUILD } from "next/constants";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // `next build` must never touch the database.
    if (process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD) {
      return;
    }
    if (!process.env.DATABASE_URL) {
      console.warn(
        "[retention] DATABASE_URL is not set, so expired nominations are not deleted."
      );
      return;
    }
    // Imported here, not at the top: register also runs in the Edge runtime,
    // where pg and the database code cannot load.
    const { scheduleNominationPurge } = await import(
      "./lib/nominations-retention"
    );
    scheduleNominationPurge();
  }
}
