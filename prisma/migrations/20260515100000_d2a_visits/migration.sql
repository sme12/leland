CREATE TABLE "visits" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "service_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "price_charged" DECIMAL(10,2) NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "visits_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "visit_line_items" (
    "id" TEXT NOT NULL,
    "visit_id" TEXT NOT NULL,
    "material_id" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "unit_cost" DECIMAL(12,6) NOT NULL,
    "total_cost" DECIMAL(12,4) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "visit_line_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "visits_user_id_date_created_at_idx" ON "visits"("user_id", "date", "created_at");
CREATE INDEX "visits_user_id_customer_id_date_idx" ON "visits"("user_id", "customer_id", "date");
CREATE INDEX "visits_user_id_service_id_date_idx" ON "visits"("user_id", "service_id", "date");
CREATE INDEX "visit_line_items_visit_id_idx" ON "visit_line_items"("visit_id");
CREATE INDEX "visit_line_items_material_id_idx" ON "visit_line_items"("material_id");

ALTER TABLE "visits" ADD CONSTRAINT "visits_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "visits" ADD CONSTRAINT "visits_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "visit_line_items" ADD CONSTRAINT "visit_line_items_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "visits"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "visit_line_items" ADD CONSTRAINT "visit_line_items_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
