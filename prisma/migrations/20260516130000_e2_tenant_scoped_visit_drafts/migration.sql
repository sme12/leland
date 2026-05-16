ALTER TABLE "material_estimates" ADD COLUMN "user_id" TEXT;

UPDATE "material_estimates"
SET "user_id" = "visit_drafts"."user_id"
FROM "visit_drafts"
WHERE "material_estimates"."visit_draft_id" = "visit_drafts"."id";

ALTER TABLE "material_estimates" ALTER COLUMN "user_id" SET NOT NULL;

ALTER TABLE "visit_drafts" DROP CONSTRAINT "visit_drafts_customer_id_fkey";
ALTER TABLE "visit_drafts" DROP CONSTRAINT "visit_drafts_service_id_fkey";
ALTER TABLE "material_estimates" DROP CONSTRAINT "material_estimates_visit_draft_id_fkey";
ALTER TABLE "material_estimates" DROP CONSTRAINT "material_estimates_material_id_fkey";

DROP INDEX "material_estimates_visit_draft_id_idx";
DROP INDEX "material_estimates_material_id_idx";

ALTER TABLE "customers" ADD CONSTRAINT "customers_id_user_id_key" UNIQUE ("id", "user_id");
ALTER TABLE "materials" ADD CONSTRAINT "materials_id_user_id_key" UNIQUE ("id", "user_id");
ALTER TABLE "services" ADD CONSTRAINT "services_id_user_id_key" UNIQUE ("id", "user_id");
ALTER TABLE "visit_drafts" ADD CONSTRAINT "visit_drafts_id_user_id_key" UNIQUE ("id", "user_id");

CREATE INDEX "material_estimates_visit_draft_id_user_id_idx" ON "material_estimates"("visit_draft_id", "user_id");
CREATE INDEX "material_estimates_material_id_user_id_idx" ON "material_estimates"("material_id", "user_id");

ALTER TABLE "visit_drafts" ADD CONSTRAINT "visit_drafts_customer_id_user_id_fkey" FOREIGN KEY ("customer_id", "user_id") REFERENCES "customers"("id", "user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "visit_drafts" ADD CONSTRAINT "visit_drafts_service_id_user_id_fkey" FOREIGN KEY ("service_id", "user_id") REFERENCES "services"("id", "user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "material_estimates" ADD CONSTRAINT "material_estimates_visit_draft_id_user_id_fkey" FOREIGN KEY ("visit_draft_id", "user_id") REFERENCES "visit_drafts"("id", "user_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "material_estimates" ADD CONSTRAINT "material_estimates_material_id_user_id_fkey" FOREIGN KEY ("material_id", "user_id") REFERENCES "materials"("id", "user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
