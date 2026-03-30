-- Migration: Add attachments table for file uploads linked to events or journal entries
--
-- This migration:
-- 1. Creates the attachment_category enum
-- 2. Creates the attachments table with proper constraints
-- 3. Adds indexes for efficient querying

-- Create enum for attachment categories
CREATE TYPE "public"."attachment_category" AS ENUM('lab_result', 'prescription', 'insurance', 'billing', 'imaging', 'other');--> statement-breakpoint

-- Create attachments table
CREATE TABLE "attachments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "profile_id" uuid NOT NULL,
  "event_id" uuid,
  "journal_id" uuid,
  "file_url" varchar NOT NULL,
  "description" text,
  "ocr_text" text,
  "category" "attachment_category" NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "attachments_parent_check" CHECK (
    (event_id IS NOT NULL AND journal_id IS NULL) OR
    (event_id IS NULL AND journal_id IS NOT NULL)
  )
);--> statement-breakpoint

-- Add foreign key constraints
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_profile_id_care_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."care_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_journal_id_journal_entries_id_fk" FOREIGN KEY ("journal_id") REFERENCES "public"."journal_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

-- Create indexes for efficient querying
CREATE INDEX "attachments_profile_idx" ON "attachments" ("profile_id");--> statement-breakpoint
CREATE INDEX "attachments_event_idx" ON "attachments" ("event_id");--> statement-breakpoint
CREATE INDEX "attachments_journal_idx" ON "attachments" ("journal_id");
