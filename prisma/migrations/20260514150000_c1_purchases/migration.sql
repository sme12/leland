CREATE TABLE "purchases" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "material_id" TEXT NOT NULL,
    "total_quantity" DECIMAL(10,2) NOT NULL,
    "total_price" DECIMAL(10,2) NOT NULL,
    "date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchases_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "purchases_user_id_date_created_at_idx" ON "purchases"("user_id", "date", "created_at");
CREATE INDEX "purchases_user_id_material_id_date_idx" ON "purchases"("user_id", "material_id", "date");

ALTER TABLE "purchases"
ADD CONSTRAINT "purchases_material_id_fkey"
FOREIGN KEY ("material_id")
REFERENCES "materials"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;
