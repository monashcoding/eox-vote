/**
 * Adds the sample nominees, MAC's mascots Min and Max in costume, to a
 * session, photos included:
 *
 *   pnpm db:seed <session id>
 *
 * Without an id it lists the sessions. A name the session already has is
 * skipped, so running it twice adds nothing. It connects with DATABASE_URL
 * from the environment or `.env`, like drizzle-kit.
 */
import { readFile } from "node:fs/promises";
import { count, desc, eq } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import { Stage } from "../../lib/api-types.ts";
import {
  appSettings,
  nomineePhotos,
  nominees,
  sessions,
} from "../../lib/db/schema.ts";

/** Photos live in ./photos, JPEG like the app's own resized uploads. */
const SAMPLE_NOMINEES = [
  { firstName: "Mia", lastName: "Chen", photo: "mia-chen.jpg" },
  { firstName: "Lachlan", lastName: "Brooks", photo: "lachlan-brooks.jpg" },
  { firstName: "Priya", lastName: "Raman", photo: "priya-raman.jpg" },
  { firstName: "Ethan", lastName: "Nguyen", photo: "ethan-nguyen.jpg" },
  { firstName: "Zara", lastName: "Ahmed", photo: "zara-ahmed.jpg" },
  { firstName: "Oliver", lastName: "Tan", photo: "oliver-tan.jpg" },
  { firstName: "Grace", lastName: "Kim", photo: "grace-kim.jpg" },
  { firstName: "Noah", lastName: "Patel", photo: "noah-patel.jpg" },
];

/**
 * Stored in place of a device token hash. Real ones are 64 hex characters,
 * so no attendee can edit or delete these; hosts still can.
 */
const SEED_OWNER = "seed";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const fullName = (n: { firstName: string; lastName: string }) =>
  `${n.firstName} ${n.lastName}`;

async function listSessions(db: NodePgDatabase): Promise<void> {
  const rows = await db
    .select({
      id: sessions.id,
      name: sessions.name,
      stage: sessions.stage,
      nominees: count(nominees.id),
    })
    .from(sessions)
    .leftJoin(nominees, eq(nominees.sessionId, sessions.id))
    .groupBy(sessions.id)
    .orderBy(desc(sessions.createdAt));
  const [settings] = await db
    .select({ currentSessionId: appSettings.currentSessionId })
    .from(appSettings);

  if (rows.length === 0) {
    console.log("There are no sessions yet. Create one in the host page first.");
    return;
  }
  console.log("Sessions, newest first:");
  for (const row of rows) {
    const current = row.id === settings?.currentSessionId ? "  (current)" : "";
    console.log(
      `  ${row.id}  ${row.stage.padEnd(11)}${String(row.nominees).padStart(3)} nominees  ${row.name}${current}`
    );
  }
  console.log("\nUsage: pnpm db:seed <session id>");
}

async function seed(db: NodePgDatabase, sessionId: string): Promise<boolean> {
  if (!UUID.test(sessionId)) {
    console.error(`"${sessionId}" is not a session id.\n`);
    await listSessions(db);
    return false;
  }
  const [session] = await db
    .select({ name: sessions.name, stage: sessions.stage })
    .from(sessions)
    .where(eq(sessions.id, sessionId));
  if (!session) {
    console.error(`No session has the id ${sessionId}.\n`);
    await listSessions(db);
    return false;
  }

  const existing = new Set(
    (
      await db
        .select({ firstName: nominees.firstName, lastName: nominees.lastName })
        .from(nominees)
        .where(eq(nominees.sessionId, sessionId))
    ).map(fullName)
  );
  const toAdd = SAMPLE_NOMINEES.filter((n) => !existing.has(fullName(n)));
  const skipped = SAMPLE_NOMINEES.filter((n) => existing.has(fullName(n)));
  const photos = await Promise.all(
    toAdd.map((n) => readFile(new URL(`photos/${n.photo}`, import.meta.url)))
  );

  if (toAdd.length === 0) {
    console.log(
      `Nothing added: "${session.name}" already has all ${SAMPLE_NOMINEES.length} sample nominees.`
    );
    return true;
  }

  // All or nothing: a failure part way leaves the session as it was.
  await db.transaction(async (tx) => {
    for (const [i, n] of toAdd.entries()) {
      const [row] = await tx
        .insert(nominees)
        .values({
          sessionId,
          firstName: n.firstName,
          lastName: n.lastName,
          ownerTokenHash: SEED_OWNER,
        })
        .returning({ id: nominees.id });
      await tx
        .insert(nomineePhotos)
        .values({ nomineeId: row.id, contentType: "image/jpeg", data: photos[i] });
    }
  });

  console.log(
    `Added ${toAdd.length} to "${session.name}": ${toAdd.map(fullName).join(", ")}.`
  );
  if (skipped.length) {
    console.log(
      `Skipped ${skipped.length} it already has: ${skipped.map(fullName).join(", ")}.`
    );
  }
  if (session.stage !== Stage.Nominating && session.stage !== Stage.Voting) {
    console.log(
      `It is ${session.stage}; attendees see nominees while it is nominating or voting.`
    );
  }
  return true;
}

try {
  process.loadEnvFile();
} catch {
  // No .env: DATABASE_URL has to come from the environment.
}
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Copy .env.example to .env and configure it.");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: url });
const db = drizzle({ client: pool });
try {
  const sessionId = process.argv[2];
  if (sessionId) {
    process.exitCode = (await seed(db, sessionId)) ? 0 : 1;
  } else {
    await listSessions(db);
  }
} finally {
  await pool.end();
}
