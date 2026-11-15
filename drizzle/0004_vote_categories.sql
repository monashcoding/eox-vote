CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"name" text NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "categories_session_id_idx" ON "categories" USING btree ("session_id");--> statement-breakpoint
-- Every existing session gets the one category it always voted in.
INSERT INTO "categories" ("session_id", "name", "position") SELECT "id", 'Best Dressed', 0 FROM "sessions";--> statement-breakpoint
ALTER TABLE "votes" ADD COLUMN "category_id" uuid;--> statement-breakpoint
-- Each session has exactly one category at this point, so every vote has one match.
UPDATE "votes" SET "category_id" = "categories"."id" FROM "nominees", "categories" WHERE "nominees"."id" = "votes"."nominee_id" AND "categories"."session_id" = "nominees"."session_id";--> statement-breakpoint
ALTER TABLE "votes" ALTER COLUMN "category_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "votes" DROP CONSTRAINT "votes_nominee_id_voter_token_hash_pk";--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_nominee_id_category_id_voter_token_hash_pk" PRIMARY KEY("nominee_id","category_id","voter_token_hash");--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "votes_category_id_idx" ON "votes" USING btree ("category_id");
