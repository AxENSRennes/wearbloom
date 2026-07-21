ALTER TABLE "quota_ledger" DROP CONSTRAINT "quota_ledger_render_variant_id_render_variants_id_fk";
--> statement-breakpoint
ALTER TABLE "render_variants" DROP CONSTRAINT "render_variants_reference_photo_id_reference_photos_id_fk";
--> statement-breakpoint
ALTER TABLE "quota_ledger" ALTER COLUMN "render_variant_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "render_variants" ALTER COLUMN "reference_photo_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "quota_ledger" ADD CONSTRAINT "quota_ledger_render_variant_id_render_variants_id_fk" FOREIGN KEY ("render_variant_id") REFERENCES "public"."render_variants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "render_variants" ADD CONSTRAINT "render_variants_reference_photo_id_reference_photos_id_fk" FOREIGN KEY ("reference_photo_id") REFERENCES "public"."reference_photos"("id") ON DELETE set null ON UPDATE no action;