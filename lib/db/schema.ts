import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  boolean,
  smallint,
  timestamp,
  primaryKey,
  index,
  uniqueIndex,
  check,
  customType,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const bytea = customType<{ data: Buffer }>({
  dataType() {
    return "bytea";
  },
});

export const sessionStageEnum = pgEnum("session_stage", [
  "pending",
  "nominating",
  "voting",
  "results",
  "finished",
]);

export const sponsors = pgTable(
  "sponsors",
  {
    id: uuid().primaryKey().defaultRandom(),
    name: text().notNull(),
    shortName: text("short_name"),
    logoVersion: integer("logo_version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("sponsors_name_lower_idx").on(sql`lower(${t.name})`)]
);

/** Kept apart from `sponsors` (like `nominee_photos`) so listing sponsors stays light. */
export const sponsorLogos = pgTable("sponsor_logos", {
  sponsorId: uuid("sponsor_id")
    .primaryKey()
    .references(() => sponsors.id, { onDelete: "cascade" }),
  contentType: text("content_type").notNull(),
  data: bytea("data").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const sessions = pgTable(
  "sessions",
  {
    id: uuid().primaryKey().defaultRandom(),
    name: text().notNull(),
    stage: sessionStageEnum().notNull().default("pending"),
    nominatingMinutes: integer("nominating_minutes").notNull().default(30),
    votingMinutes: integer("voting_minutes").notNull().default(45),
    autoAdvance: boolean("auto_advance").notNull().default(false),
    timerEndsAt: timestamp("timer_ends_at", { withTimezone: true }),
    timerRemainingMs: integer("timer_remaining_ms"),
    revealedCount: integer("revealed_count").notNull().default(0),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    sponsorId: uuid("sponsor_id").references(() => sponsors.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check(
      "nominating_minutes_range",
      sql`${t.nominatingMinutes} >= 0 AND ${t.nominatingMinutes} <= 600`
    ),
    check(
      "voting_minutes_range",
      sql`${t.votingMinutes} >= 0 AND ${t.votingMinutes} <= 600`
    ),
    check(
      "timer_remaining_ms_non_negative",
      sql`${t.timerRemainingMs} >= 0`
    ),
    check(
      "revealed_count_non_negative",
      sql`${t.revealedCount} >= 0`
    ),
    check(
      "timer_not_both",
      sql`NOT (${t.timerEndsAt} IS NOT NULL AND ${t.timerRemainingMs} IS NOT NULL)`
    ),
  ]
);

/**
 * What a session votes on, for example "Best Dressed". Every nominee is
 * voted on in every category of their session, one category after another
 * in `position` order, which is also the order results are revealed in.
 */
export const categories = pgTable(
  "categories",
  {
    id: uuid().primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    name: text().notNull(),
    position: integer().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("categories_session_id_idx").on(t.sessionId)]
);

export const nominees = pgTable(
  "nominees",
  {
    id: uuid().primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    ownerTokenHash: text("owner_token_hash").notNull(),
    photoVersion: integer("photo_version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("nominees_session_id_idx").on(t.sessionId),
    index("nominees_owner_token_hash_idx").on(t.ownerTokenHash),
  ]
);

export const nomineePhotos = pgTable("nominee_photos", {
  nomineeId: uuid("nominee_id")
    .primaryKey()
    .references(() => nominees.id, { onDelete: "cascade" }),
  contentType: text("content_type").notNull(),
  data: bytea("data").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const votes = pgTable(
  "votes",
  {
    nomineeId: uuid("nominee_id")
      .notNull()
      .references(() => nominees.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    voterTokenHash: text("voter_token_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.nomineeId, t.categoryId, t.voterTokenHash] }),
    index("votes_voter_token_hash_idx").on(t.voterTokenHash),
    index("votes_category_id_idx").on(t.categoryId),
  ]
);

export const appSettings = pgTable(
  "app_settings",
  {
    id: smallint().primaryKey().default(1),
    adminPasscode: text("admin_passcode"),
    currentSessionId: uuid("current_session_id").references(
      () => sessions.id,
      { onDelete: "set null" }
    ),
  },
  (t) => [check("singleton", sql`${t.id} = 1`)],
);
