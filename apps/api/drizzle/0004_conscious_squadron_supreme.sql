ALTER TABLE "clues" DROP CONSTRAINT "clues_pkey";--> statement-breakpoint
ALTER TABLE "clues" ADD CONSTRAINT "clues_catalog_version_id_id_pk" PRIMARY KEY("catalog_version_id","id");
