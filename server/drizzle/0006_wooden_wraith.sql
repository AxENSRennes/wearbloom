CREATE TABLE "privacy_preferences" (
	"owner_id" text PRIMARY KEY NOT NULL,
	"analytics_enabled" boolean DEFAULT false NOT NULL,
	"diagnostics_enabled" boolean DEFAULT false NOT NULL,
	"consent_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "privacy_preferences" ADD CONSTRAINT "privacy_preferences_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;