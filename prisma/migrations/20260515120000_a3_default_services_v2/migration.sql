-- Reshape the default service catalog:
--   - remove (archive) service.cut and service.treatment
--   - add service.complexColor at display_order = 2
--   - reprice service.color (30) and service.cutAndColor (40)
--   - final order: color=1, complexColor=2, cutAndColor=3, other=4
--
-- visits.service_id is ON DELETE RESTRICT, so we archive instead of delete.
-- To avoid transient unique-index violations on (user_id, display_order),
-- we first push every existing service to a high temp range, then assign
-- the final orders.

-- 1. Shift every service into a temp display_order range so we can reorder
--    without conflicting with the (user_id, display_order) unique index.
UPDATE "services" SET "display_order" = "display_order" + 500;

-- 2. Archive removed services and move them out of the way of new orders.
UPDATE "services"
SET "is_archived" = true,
    "display_order" = "display_order" + 1000,
    "updated_at" = NOW()
WHERE "name" IN ('service.cut', 'service.treatment');

-- 3. Reprice and assign final orders for surviving services.
UPDATE "services"
SET "default_price" = 30, "display_order" = 1, "updated_at" = NOW()
WHERE "name" = 'service.color';

UPDATE "services"
SET "default_price" = 40, "display_order" = 3, "updated_at" = NOW()
WHERE "name" = 'service.cutAndColor';

UPDATE "services"
SET "display_order" = 4, "updated_at" = NOW()
WHERE "name" = 'service.other';

-- 4. Insert service.complexColor at display_order = 2 for every existing
--    tenant (one row per user_id that already has service.color), unless
--    they somehow already have it.
INSERT INTO "services" (
  "id", "user_id", "name", "default_price", "display_order",
  "is_archived", "created_at", "updated_at"
)
SELECT
  gen_random_uuid()::text,
  s."user_id",
  'service.complexColor',
  40,
  2,
  false,
  NOW(),
  NOW()
FROM "services" s
WHERE s."name" = 'service.color'
  AND NOT EXISTS (
    SELECT 1
    FROM "services" s2
    WHERE s2."user_id" = s."user_id"
      AND s2."name" = 'service.complexColor'
  );
