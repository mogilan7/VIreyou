-- Migration: Add partial unique index on User.telegram_id (where telegram_id is not null and not empty)
-- Pre-condition: All duplicates of telegram_id must be merged before executing this migration.

CREATE UNIQUE INDEX IF NOT EXISTS "User_telegram_id_unique_idx"
ON "public"."User" ("telegram_id")
WHERE "telegram_id" IS NOT NULL AND "telegram_id" != '';
