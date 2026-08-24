CREATE TYPE "public"."achievement_verification" AS ENUM('casual', 'verified');--> statement-breakpoint
CREATE TABLE "achievement_definitions" (
	"description" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"target" integer NOT NULL,
	"title" text NOT NULL,
	"type" text NOT NULL,
	CONSTRAINT "achievement_definitions_target_positive" CHECK ("achievement_definitions"."target" > 0)
);
--> statement-breakpoint
INSERT INTO "achievement_definitions" ("description", "id", "target", "title", "type") VALUES
	('İlk bulmacanı tamamla.', 'first-completion', 1, 'İlk Çözüm', 'completion'),
	('Bir bulmacayı ipucu kullanmadan tamamla.', 'no-hint-completion', 1, 'İpucusuz', 'no-hint-completion'),
	('Art arda 3 Günün Bulmacası’nı tamamla.', 'daily-streak-3', 3, '3 Günlük Seri', 'daily-streak'),
	('Art arda 7 Günün Bulmacası’nı tamamla.', 'daily-streak-7', 7, '7 Günlük Seri', 'daily-streak');
--> statement-breakpoint
CREATE TABLE "user_achievements" (
	"achievement_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"earned_at" timestamp with time zone NOT NULL,
	"evidence" jsonb NOT NULL,
	"user_id" uuid NOT NULL,
	"verification" "achievement_verification" NOT NULL,
	CONSTRAINT "user_achievements_user_id_achievement_id_pk" PRIMARY KEY("user_id","achievement_id")
);
--> statement-breakpoint
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_achievement_id_achievement_definitions_id_fk" FOREIGN KEY ("achievement_id") REFERENCES "public"."achievement_definitions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_user_id_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_achievements_earned_idx" ON "user_achievements" USING btree ("user_id","earned_at");
