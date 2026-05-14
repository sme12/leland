CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "comment" TEXT,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "services" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "default_price" DECIMAL(10,2),
    "display_order" INTEGER NOT NULL,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "customers_user_id_is_archived_name_idx" ON "customers"("user_id", "is_archived", "name");
CREATE UNIQUE INDEX "services_user_id_name_key" ON "services"("user_id", "name");
CREATE UNIQUE INDEX "services_user_id_display_order_key" ON "services"("user_id", "display_order");
CREATE INDEX "services_user_id_is_archived_display_order_idx" ON "services"("user_id", "is_archived", "display_order");
