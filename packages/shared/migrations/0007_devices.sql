-- Device status enum
CREATE TYPE "public"."device_status" AS ENUM('online', 'offline');

-- Devices table - kiosk tablets paired via QR code
CREATE TABLE IF NOT EXISTS "devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_token" varchar NOT NULL,
	"name" varchar NOT NULL,
	"status" "device_status" DEFAULT 'offline' NOT NULL,
	"battery_level" integer,
	"last_seen_at" timestamp,
	"paired_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "devices_device_token_unique" UNIQUE("device_token")
);

-- Device care profiles - links devices to care profiles
CREATE TABLE IF NOT EXISTS "device_care_profiles" (
	"device_id" uuid NOT NULL,
	"care_profile_id" uuid NOT NULL,
	CONSTRAINT "device_care_profiles_device_id_care_profile_id_pk" PRIMARY KEY("device_id","care_profile_id")
);

-- Device access - tracks which caretakers can manage a device
CREATE TABLE IF NOT EXISTS "device_access" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"granted_by" uuid,
	"granted_at" timestamp DEFAULT now() NOT NULL
);

-- Device pairing tokens - temporary QR tokens for pairing
CREATE TABLE IF NOT EXISTS "device_pairing_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token" varchar NOT NULL,
	"device_id" uuid,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "device_pairing_tokens_token_unique" UNIQUE("token")
);

-- Foreign keys
ALTER TABLE "device_care_profiles" ADD CONSTRAINT "device_care_profiles_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "device_care_profiles" ADD CONSTRAINT "device_care_profiles_care_profile_id_care_profiles_id_fk" FOREIGN KEY ("care_profile_id") REFERENCES "public"."care_profiles"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "device_access" ADD CONSTRAINT "device_access_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "device_access" ADD CONSTRAINT "device_access_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "device_access" ADD CONSTRAINT "device_access_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "device_pairing_tokens" ADD CONSTRAINT "device_pairing_tokens_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;

-- Indexes
CREATE INDEX IF NOT EXISTS "devices_token_idx" ON "devices" USING btree ("device_token");
CREATE INDEX IF NOT EXISTS "device_access_device_user_idx" ON "device_access" USING btree ("device_id","user_id");
CREATE INDEX IF NOT EXISTS "device_pairing_tokens_token_idx" ON "device_pairing_tokens" USING btree ("token");
