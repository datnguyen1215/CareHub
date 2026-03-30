ALTER TABLE "journal_entries" DROP CONSTRAINT "journal_entries_linked_event_id_events_id_fk";
--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_linked_event_id_events_id_fk" FOREIGN KEY ("linked_event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;