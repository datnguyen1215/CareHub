-- Migration: Replace group-based access with profile-level ownership
--
-- This migration:
-- 1. Creates the profile_share_role enum
-- 2. Adds user_id column to care_profiles
-- 3. Migrates data: assigns profile ownership to group admin
-- 4. Creates profile_shares table
-- 5. Drops group-related tables and columns

-- Create new enum for profile sharing roles
CREATE TYPE "public"."profile_share_role" AS ENUM('admin', 'viewer');--> statement-breakpoint

-- Add user_id column to care_profiles (nullable initially for migration)
ALTER TABLE "care_profiles" ADD COLUMN "user_id" uuid;--> statement-breakpoint

-- Migrate data: set user_id to the admin of the group that owns the profile
UPDATE "care_profiles" cp
SET "user_id" = (
  SELECT gm."user_id"
  FROM "group_members" gm
  WHERE gm."group_id" = cp."group_id" AND gm."role" = 'admin'
  LIMIT 1
);--> statement-breakpoint

-- For any profiles without an admin, use any member
UPDATE "care_profiles" cp
SET "user_id" = (
  SELECT gm."user_id"
  FROM "group_members" gm
  WHERE gm."group_id" = cp."group_id"
  LIMIT 1
)
WHERE cp."user_id" IS NULL;--> statement-breakpoint

-- Now make user_id NOT NULL and add foreign key
ALTER TABLE "care_profiles" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "care_profiles" ADD CONSTRAINT "care_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint

-- Create profile_shares table
CREATE TABLE "profile_shares" (
  "profile_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "role" "profile_share_role" NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "profile_shares_profile_id_user_id_pk" PRIMARY KEY("profile_id","user_id")
);--> statement-breakpoint
ALTER TABLE "profile_shares" ADD CONSTRAINT "profile_shares_profile_id_care_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."care_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_shares" ADD CONSTRAINT "profile_shares_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

-- Update foreign keys to cascade delete
ALTER TABLE "medications" DROP CONSTRAINT "medications_care_profile_id_care_profiles_id_fk";--> statement-breakpoint
ALTER TABLE "medications" ADD CONSTRAINT "medications_care_profile_id_care_profiles_id_fk" FOREIGN KEY ("care_profile_id") REFERENCES "public"."care_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

-- Drop old group-related constraints and columns
ALTER TABLE "care_profiles" DROP CONSTRAINT "care_profiles_group_id_groups_id_fk";--> statement-breakpoint
ALTER TABLE "care_profiles" DROP COLUMN "group_id";--> statement-breakpoint

-- Drop group_members table
DROP TABLE "group_members";--> statement-breakpoint

-- Drop groups table
DROP TABLE "groups";--> statement-breakpoint

-- Drop the old group_member_role enum
DROP TYPE "public"."group_member_role";
