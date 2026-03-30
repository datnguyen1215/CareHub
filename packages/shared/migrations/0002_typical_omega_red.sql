CREATE TYPE "public"."event_type" AS ENUM('doctor_visit', 'lab_work', 'therapy', 'general');--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"care_profile_id" uuid NOT NULL,
	"title" varchar NOT NULL,
	"event_type" "event_type" NOT NULL,
	"event_date" timestamp NOT NULL,
	"location" varchar,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_care_profile_id_care_profiles_id_fk" FOREIGN KEY ("care_profile_id") REFERENCES "public"."care_profiles"("id") ON DELETE no action ON UPDATE no action;