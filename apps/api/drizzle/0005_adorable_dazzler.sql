CREATE TABLE "subscription_events" (
	"app_user_id" text,
	"environment" text,
	"event_id" text PRIMARY KEY NOT NULL,
	"event_timestamp" timestamp with time zone NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_entitlements" (
	"active" boolean DEFAULT false NOT NULL,
	"entitlement_id" text NOT NULL,
	"environment" text,
	"expires_at" timestamp with time zone,
	"product_id" text,
	"revoked_at" timestamp with time zone,
	"source_event_id" text NOT NULL,
	"source_event_timestamp" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL,
	CONSTRAINT "user_entitlements_user_id_entitlement_id_pk" PRIMARY KEY("user_id","entitlement_id")
);
--> statement-breakpoint
ALTER TABLE "user_entitlements" ADD CONSTRAINT "user_entitlements_source_event_id_subscription_events_event_id_fk" FOREIGN KEY ("source_event_id") REFERENCES "public"."subscription_events"("event_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "subscription_events_user_timestamp_idx" ON "subscription_events" USING btree ("app_user_id","event_timestamp");--> statement-breakpoint
CREATE INDEX "user_entitlements_active_idx" ON "user_entitlements" USING btree ("user_id","active","expires_at");