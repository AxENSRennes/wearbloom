CREATE TABLE "app_attest_challenges" (
	"challenge" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_attest_keys" (
	"key_id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"public_key" text NOT NULL,
	"sign_count" integer DEFAULT 0 NOT NULL,
	"environment" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app_attest_challenges" ADD CONSTRAINT "app_attest_challenges_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_attest_keys" ADD CONSTRAINT "app_attest_keys_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "app_attest_challenge_owner_idx" ON "app_attest_challenges" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "app_attest_key_owner_idx" ON "app_attest_keys" USING btree ("owner_id");