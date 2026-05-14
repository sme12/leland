CREATE TYPE "MaterialCategory" AS ENUM (
    'color',
    'developer',
    'bleach',
    'shampoo',
    'conditioner',
    'treatment',
    'styling',
    'tools',
    'disposables',
    'other'
);

CREATE TYPE "UnitOfMeasure" AS ENUM ('ml', 'g', 'piece');

CREATE TABLE "materials" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit_of_measure" "UnitOfMeasure" NOT NULL,
    "category" "MaterialCategory" NOT NULL,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "materials_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "materials_user_id_is_archived_category_name_idx" ON "materials"("user_id", "is_archived", "category", "name");
