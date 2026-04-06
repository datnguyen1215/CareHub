-- Add app_type enum, app_releases table, and app_version column to devices

CREATE TYPE "public"."app_type" AS ENUM ('kiosk', 'portal');
--> statement-breakpoint

CREATE TABLE "app_releases" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "app" "app_type" NOT NULL,
  "version" varchar NOT NULL,
  "version_code" integer NOT NULL,
  "file_path" varchar NOT NULL,
  "file_size" integer NOT NULL,
  "checksum" varchar NOT NULL,
  "notes" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE INDEX "app_releases_app_version_code_idx" ON "app_releases" ("app", "version_code");
--> statement-breakpoint

ALTER TABLE "devices" ADD COLUMN "app_version" varchar;
