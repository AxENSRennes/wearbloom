CREATE TABLE "rate_limit_windows" (
	"owner_id" text NOT NULL,
	"action" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rate_limit_windows" ADD CONSTRAINT "rate_limit_windows_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "rate_limit_owner_action_window" ON "rate_limit_windows" USING btree ("owner_id","action","window_start");--> statement-breakpoint
CREATE INDEX "rate_limit_window_cleanup_idx" ON "rate_limit_windows" USING btree ("window_start");