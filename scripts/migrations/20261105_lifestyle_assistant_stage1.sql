-- ==============================================================================
-- Migration: Lifestyle Assistant Stage 1
-- Description:
--   1. Create knowledge_cards table (approved/draft/rejected, multi-layer, active flag)
--   2. Create knowledge_gaps table (logging missing knowledge queries)
--   3. Extend User table with assistant_beta, health consent, adult confirmation,
--      special groups, and review schedule
--   4. Extend AssistantMessage table with prompt_version, used_card_ids, and model
--   5. Backfill assistant_beta = true for test_val users
-- ==============================================================================

-- 1. Create knowledge_cards table
CREATE TABLE IF NOT EXISTS "public"."knowledge_cards" (
    "id" TEXT NOT NULL,
    "layer" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "claim" TEXT NOT NULL,
    "evidence_level" TEXT,
    "source_title" TEXT,
    "source_url" TEXT,
    "source_year" INTEGER,
    "contraindications" TEXT,
    "related_content" TEXT,
    "lang" TEXT NOT NULL DEFAULT 'ru',
    "reviewed_at" TIMESTAMPTZ(6),
    "status" TEXT NOT NULL DEFAULT 'approved',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "knowledge_cards_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "knowledge_cards_domain_lang_is_active_idx" 
ON "public"."knowledge_cards" ("domain", "lang", "is_active");

CREATE INDEX IF NOT EXISTS "knowledge_cards_layer_is_active_idx" 
ON "public"."knowledge_cards" ("layer", "is_active");

-- 2. Create knowledge_gaps table
CREATE TABLE IF NOT EXISTS "public"."knowledge_gaps" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "question" TEXT NOT NULL,
    "domain" TEXT,
    "lang" TEXT NOT NULL DEFAULT 'ru',
    "status" TEXT NOT NULL DEFAULT 'new',
    "resolution_notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMPTZ(6),
    CONSTRAINT "knowledge_gaps_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "knowledge_gaps_status_created_at_idx" 
ON "public"."knowledge_gaps" ("status", "created_at");

-- 3. Extend User table
ALTER TABLE "public"."User" 
    ADD COLUMN IF NOT EXISTS "assistant_beta" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS "health_consent_version" INTEGER,
    ADD COLUMN IF NOT EXISTS "adult_confirmed_at" TIMESTAMPTZ(6),
    ADD COLUMN IF NOT EXISTS "special_groups" JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS "review_time" TEXT DEFAULT '20:30',
    ADD COLUMN IF NOT EXISTS "next_review_at" TIMESTAMPTZ(6);

CREATE INDEX IF NOT EXISTS "User_next_review_at_idx" 
ON "public"."User" ("next_review_at");

-- 4. Extend AssistantMessage table
ALTER TABLE "public"."AssistantMessage" 
    ADD COLUMN IF NOT EXISTS "prompt_version" TEXT,
    ADD COLUMN IF NOT EXISTS "used_card_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    ADD COLUMN IF NOT EXISTS "model" TEXT;

-- 5. Backfill assistant_beta for users with start_param containing test_val
UPDATE "public"."User"
SET "assistant_beta" = true
WHERE "start_param" ILIKE '%test_val%';
