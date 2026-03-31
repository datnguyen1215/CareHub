-- Call status enum
CREATE TYPE "public"."call_status" AS ENUM('initiating', 'ringing', 'connecting', 'connected', 'ended', 'failed');

-- Call end reason enum
CREATE TYPE "public"."call_end_reason" AS ENUM('completed', 'declined', 'missed', 'cancelled', 'failed', 'timeout');

-- Call sessions table - tracks WebRTC video calls between portal and kiosk
CREATE TABLE IF NOT EXISTS "call_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"caller_user_id" uuid NOT NULL,
	"callee_device_id" uuid NOT NULL,
	"callee_profile_id" uuid,
	"status" "call_status" NOT NULL,
	"initiated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"answered_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"end_reason" "call_end_reason",
	"duration_seconds" integer,
	"ice_connection_state" varchar(30)
);

-- Foreign keys
ALTER TABLE "call_sessions" ADD CONSTRAINT "call_sessions_caller_user_id_users_id_fk" FOREIGN KEY ("caller_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "call_sessions" ADD CONSTRAINT "call_sessions_callee_device_id_devices_id_fk" FOREIGN KEY ("callee_device_id") REFERENCES "public"."devices"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "call_sessions" ADD CONSTRAINT "call_sessions_callee_profile_id_care_profiles_id_fk" FOREIGN KEY ("callee_profile_id") REFERENCES "public"."care_profiles"("id") ON DELETE no action ON UPDATE no action;

-- Indexes
CREATE INDEX IF NOT EXISTS "idx_call_sessions_caller" ON "call_sessions" USING btree ("caller_user_id");
CREATE INDEX IF NOT EXISTS "idx_call_sessions_device" ON "call_sessions" USING btree ("callee_device_id");
CREATE INDEX IF NOT EXISTS "idx_call_sessions_status" ON "call_sessions" USING btree ("status");
