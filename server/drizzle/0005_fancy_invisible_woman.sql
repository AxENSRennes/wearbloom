CREATE TABLE "apple_subscription_notifications" (
	"notification_uuid" uuid PRIMARY KEY NOT NULL,
	"notification_type" text NOT NULL,
	"subtype" text,
	"environment" text,
	"original_transaction_id" text,
	"signed_at" timestamp with time zone,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "entitlements" DROP CONSTRAINT "entitlements_revenuecat_app_user_id_unique";--> statement-breakpoint
ALTER TABLE "entitlements" ADD COLUMN "apple_app_account_token" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "entitlements" ADD COLUMN "original_transaction_id" text;--> statement-breakpoint
ALTER TABLE "entitlements" ADD COLUMN "latest_transaction_id" text;--> statement-breakpoint
ALTER TABLE "entitlements" ADD COLUMN "status" text DEFAULT 'inactive' NOT NULL;--> statement-breakpoint
ALTER TABLE "entitlements" ADD COLUMN "will_renew" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "entitlements" ADD COLUMN "environment" text;--> statement-breakpoint
ALTER TABLE "entitlements" ADD COLUMN "last_apple_signed_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "apple_subscription_notifications_transaction_idx" ON "apple_subscription_notifications" USING btree ("original_transaction_id");--> statement-breakpoint
CREATE INDEX "apple_subscription_notifications_received_idx" ON "apple_subscription_notifications" USING btree ("received_at");--> statement-breakpoint
ALTER TABLE "entitlements" DROP COLUMN "revenuecat_app_user_id";--> statement-breakpoint
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_apple_app_account_token_unique" UNIQUE("apple_app_account_token");--> statement-breakpoint
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_original_transaction_id_unique" UNIQUE("original_transaction_id");