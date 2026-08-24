CREATE TYPE "public"."gameplay_difficulty" AS ENUM('beginner', 'easy', 'medium', 'hard');--> statement-breakpoint
CREATE TYPE "public"."generation_run_status" AS ENUM('queued', 'running', 'succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."publication_status" AS ENUM('draft', 'published', 'retired');--> statement-breakpoint
CREATE TYPE "public"."puzzle_validation_mode" AS ENUM('offline-casual', 'server-verified');--> statement-breakpoint
CREATE TABLE "clue_catalog_versions" (
	"checksum" text NOT NULL,
	"confirmed_at" date NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"rights_basis" text NOT NULL,
	"source_file" text NOT NULL,
	CONSTRAINT "clue_catalog_versions_checksum_unique" UNIQUE("checksum")
);
--> statement-breakpoint
CREATE TABLE "clues" (
	"answer" text NOT NULL,
	"answer_length" integer NOT NULL,
	"catalog_version_id" text NOT NULL,
	"category" text NOT NULL,
	"clue" text NOT NULL,
	"difficulty" "gameplay_difficulty" NOT NULL,
	"fallback_only" boolean DEFAULT false NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"short_clue" text NOT NULL,
	CONSTRAINT "clues_answer_length_positive" CHECK ("clues"."answer_length" > 0)
);
--> statement-breakpoint
CREATE TABLE "generation_runs" (
	"catalog_version_id" text NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"error" text,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" text NOT NULL,
	"publication_date" date NOT NULL,
	"quality_report" jsonb,
	"request_hash" text NOT NULL,
	"revision" text NOT NULL,
	"seed" text NOT NULL,
	"started_at" timestamp with time zone,
	"status" "generation_run_status" DEFAULT 'queued' NOT NULL,
	CONSTRAINT "generation_runs_request_hash_unique" UNIQUE("request_hash")
);
--> statement-breakpoint
CREATE TABLE "puzzle_publications" (
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"publication_date" date NOT NULL,
	"publication_key" text DEFAULT 'daily' NOT NULL,
	"published_at" timestamp with time zone,
	"puzzle_record_id" uuid NOT NULL,
	"required_entitlement" text,
	"status" "publication_status" DEFAULT 'draft' NOT NULL,
	"timezone" text DEFAULT 'Europe/Istanbul' NOT NULL,
	CONSTRAINT "puzzle_publications_published_at_required" CHECK ("puzzle_publications"."status" <> 'published' OR "puzzle_publications"."published_at" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "puzzles" (
	"catalog_version_id" text NOT NULL,
	"categories" text[] NOT NULL,
	"checksum" text NOT NULL,
	"column_count" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"definition" jsonb NOT NULL,
	"difficulty" "gameplay_difficulty" NOT NULL,
	"id" text NOT NULL,
	"quality_passed" boolean DEFAULT false NOT NULL,
	"record_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"row_count" integer NOT NULL,
	"title" text NOT NULL,
	"validation_mode" "puzzle_validation_mode" DEFAULT 'offline-casual' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "puzzles_version_positive" CHECK ("puzzles"."version" > 0),
	CONSTRAINT "puzzles_dimensions_positive" CHECK ("puzzles"."row_count" > 0 AND "puzzles"."column_count" > 0)
);
--> statement-breakpoint
ALTER TABLE "clues" ADD CONSTRAINT "clues_catalog_version_id_clue_catalog_versions_id_fk" FOREIGN KEY ("catalog_version_id") REFERENCES "public"."clue_catalog_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_runs" ADD CONSTRAINT "generation_runs_catalog_version_id_clue_catalog_versions_id_fk" FOREIGN KEY ("catalog_version_id") REFERENCES "public"."clue_catalog_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "puzzle_publications" ADD CONSTRAINT "puzzle_publications_puzzle_record_id_puzzles_record_id_fk" FOREIGN KEY ("puzzle_record_id") REFERENCES "public"."puzzles"("record_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "puzzles" ADD CONSTRAINT "puzzles_catalog_version_id_clue_catalog_versions_id_fk" FOREIGN KEY ("catalog_version_id") REFERENCES "public"."clue_catalog_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "clues_catalog_version_idx" ON "clues" USING btree ("catalog_version_id");--> statement-breakpoint
CREATE INDEX "clues_generation_filter_idx" ON "clues" USING btree ("difficulty","category","answer_length");--> statement-breakpoint
CREATE INDEX "generation_runs_publication_date_idx" ON "generation_runs" USING btree ("publication_date");--> statement-breakpoint
CREATE INDEX "generation_runs_status_idx" ON "generation_runs" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "puzzle_publications_active_date_unique" ON "puzzle_publications" USING btree ("publication_date","publication_key") WHERE "puzzle_publications"."status" = 'published';--> statement-breakpoint
CREATE INDEX "puzzle_publications_puzzle_idx" ON "puzzle_publications" USING btree ("puzzle_record_id");--> statement-breakpoint
CREATE INDEX "puzzle_publications_visible_idx" ON "puzzle_publications" USING btree ("status","publication_date");--> statement-breakpoint
CREATE UNIQUE INDEX "puzzles_id_version_unique" ON "puzzles" USING btree ("id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "puzzles_checksum_unique" ON "puzzles" USING btree ("checksum");--> statement-breakpoint
CREATE INDEX "puzzles_catalog_version_idx" ON "puzzles" USING btree ("catalog_version_id");--> statement-breakpoint
CREATE INDEX "puzzles_catalog_filter_idx" ON "puzzles" USING btree ("difficulty","created_at");