CREATE TYPE "public"."session_stage" AS ENUM('pending', 'nominating', 'voting', 'results', 'finished');--> statement-breakpoint
CREATE TABLE "app_settings" (
	"id" smallint PRIMARY KEY DEFAULT 1 NOT NULL,
	"admin_passcode" text,
	"current_session_id" uuid,
	CONSTRAINT "singleton" CHECK ("app_settings"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE "nominee_photos" (
	"nominee_id" uuid PRIMARY KEY NOT NULL,
	"content_type" text NOT NULL,
	"data" "bytea" NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nominees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"owner_token_hash" text NOT NULL,
	"photo_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"stage" "session_stage" DEFAULT 'pending' NOT NULL,
	"nominating_minutes" integer DEFAULT 30 NOT NULL,
	"voting_minutes" integer DEFAULT 45 NOT NULL,
	"auto_advance" boolean DEFAULT false NOT NULL,
	"timer_ends_at" timestamp with time zone,
	"timer_remaining_ms" integer,
	"revealed_count" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "nominating_minutes_range" CHECK ("sessions"."nominating_minutes" >= 0 AND "sessions"."nominating_minutes" <= 600),
	CONSTRAINT "voting_minutes_range" CHECK ("sessions"."voting_minutes" >= 0 AND "sessions"."voting_minutes" <= 600),
	CONSTRAINT "timer_remaining_ms_non_negative" CHECK ("sessions"."timer_remaining_ms" >= 0),
	CONSTRAINT "revealed_count_non_negative" CHECK ("sessions"."revealed_count" >= 0),
	CONSTRAINT "timer_not_both" CHECK (NOT ("sessions"."timer_ends_at" IS NOT NULL AND "sessions"."timer_remaining_ms" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "votes" (
	"nominee_id" uuid NOT NULL,
	"voter_token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "votes_nominee_id_voter_token_hash_pk" PRIMARY KEY("nominee_id","voter_token_hash")
);
--> statement-breakpoint
ALTER TABLE "app_settings" ADD CONSTRAINT "app_settings_current_session_id_sessions_id_fk" FOREIGN KEY ("current_session_id") REFERENCES "public"."sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nominee_photos" ADD CONSTRAINT "nominee_photos_nominee_id_nominees_id_fk" FOREIGN KEY ("nominee_id") REFERENCES "public"."nominees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nominees" ADD CONSTRAINT "nominees_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_nominee_id_nominees_id_fk" FOREIGN KEY ("nominee_id") REFERENCES "public"."nominees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "nominees_session_id_idx" ON "nominees" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "nominees_owner_token_hash_idx" ON "nominees" USING btree ("owner_token_hash");--> statement-breakpoint
CREATE INDEX "votes_voter_token_hash_idx" ON "votes" USING btree ("voter_token_hash");