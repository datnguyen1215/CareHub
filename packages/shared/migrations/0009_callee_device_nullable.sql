-- Make callee_device_id nullable and change FK to ON DELETE SET NULL
-- This allows devices to be deleted while preserving historical call session records.

ALTER TABLE "call_sessions" ALTER COLUMN "callee_device_id" DROP NOT NULL;

ALTER TABLE "call_sessions" DROP CONSTRAINT "call_sessions_callee_device_id_devices_id_fk";

ALTER TABLE "call_sessions" ADD CONSTRAINT "call_sessions_callee_device_id_devices_id_fk"
  FOREIGN KEY ("callee_device_id") REFERENCES "public"."devices"("id") ON DELETE SET NULL ON UPDATE no action;
