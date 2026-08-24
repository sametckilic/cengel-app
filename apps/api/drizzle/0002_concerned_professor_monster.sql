CREATE TYPE "public"."progress_operation" AS ENUM('delete', 'upsert');--> statement-breakpoint
CREATE TABLE "devices" (
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"id" uuid PRIMARY KEY NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"platform" text NOT NULL,
	"user_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE "progress_events" (
	"client_updated_at" timestamp with time zone NOT NULL,
	"device_id" uuid NOT NULL,
	"event_id" uuid PRIMARY KEY NOT NULL,
	"operation" "progress_operation" NOT NULL,
	"puzzle_id" text NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"snapshot" jsonb,
	"user_id" uuid NOT NULL,
	CONSTRAINT "progress_events_snapshot_operation" CHECK (("progress_events"."operation" = 'upsert' AND "progress_events"."snapshot" IS NOT NULL) OR ("progress_events"."operation" = 'delete' AND "progress_events"."snapshot" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "user_puzzle_progress" (
	"client_updated_at" timestamp with time zone NOT NULL,
	"deleted" boolean DEFAULT false NOT NULL,
	"device_id" uuid NOT NULL,
	"puzzle_id" text NOT NULL,
	"server_version" integer DEFAULT 1 NOT NULL,
	"snapshot" jsonb,
	"source_event_id" uuid NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL,
	CONSTRAINT "user_puzzle_progress_user_id_puzzle_id_pk" PRIMARY KEY("user_id","puzzle_id"),
	CONSTRAINT "user_puzzle_progress_version_positive" CHECK ("user_puzzle_progress"."server_version" > 0),
	CONSTRAINT "user_puzzle_progress_snapshot_deleted" CHECK (("user_puzzle_progress"."deleted" = false AND "user_puzzle_progress"."snapshot" IS NOT NULL) OR ("user_puzzle_progress"."deleted" = true AND "user_puzzle_progress"."snapshot" IS NULL))
);
--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_user_id_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progress_events" ADD CONSTRAINT "progress_events_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progress_events" ADD CONSTRAINT "progress_events_user_id_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_puzzle_progress" ADD CONSTRAINT "user_puzzle_progress_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_puzzle_progress" ADD CONSTRAINT "user_puzzle_progress_source_event_id_progress_events_event_id_fk" FOREIGN KEY ("source_event_id") REFERENCES "public"."progress_events"("event_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_puzzle_progress" ADD CONSTRAINT "user_puzzle_progress_user_id_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "devices_user_id_idx" ON "devices" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "progress_events_user_received_idx" ON "progress_events" USING btree ("user_id","received_at");--> statement-breakpoint
CREATE INDEX "progress_events_puzzle_idx" ON "progress_events" USING btree ("user_id","puzzle_id");--> statement-breakpoint
CREATE INDEX "user_puzzle_progress_updated_idx" ON "user_puzzle_progress" USING btree ("user_id","updated_at");