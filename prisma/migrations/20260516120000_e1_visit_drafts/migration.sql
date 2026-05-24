CREATE TABLE "visit_drafts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "service_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "estimated_price" DECIMAL(10,2),
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "visit_drafts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "material_estimates" (
    "id" TEXT NOT NULL,
    "visit_draft_id" TEXT NOT NULL,
    "material_id" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "material_estimates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "visit_drafts_user_id_date_created_at_idx" ON "visit_drafts"("user_id", "date", "created_at");
CREATE INDEX "visit_drafts_user_id_customer_id_date_idx" ON "visit_drafts"("user_id", "customer_id", "date");
CREATE INDEX "visit_drafts_user_id_service_id_date_idx" ON "visit_drafts"("user_id", "service_id", "date");
CREATE INDEX "material_estimates_visit_draft_id_idx" ON "material_estimates"("visit_draft_id");
CREATE INDEX "material_estimates_material_id_idx" ON "material_estimates"("material_id");

ALTER TABLE "visit_drafts" ADD CONSTRAINT "visit_drafts_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "visit_drafts" ADD CONSTRAINT "visit_drafts_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "material_estimates" ADD CONSTRAINT "material_estimates_visit_draft_id_fkey" FOREIGN KEY ("visit_draft_id") REFERENCES "visit_drafts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "material_estimates" ADD CONSTRAINT "material_estimates_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
