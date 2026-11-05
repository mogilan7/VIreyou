import dotenv from "dotenv";
import fs from "fs";
import path from "path";
dotenv.config();
dotenv.config({ path: ".env.local", override: true });

import { PrismaClient } from "@prisma/client";

async function main() {
  const directUrl = (process.env.DIRECT_URL || process.env.DATABASE_URL || "").trim();
  if (!directUrl) {
    throw new Error("Neither DIRECT_URL nor DATABASE_URL found in environment");
  }

  const prisma = new PrismaClient({
    datasourceUrl: directUrl,
  });

  console.log("Applying Lifestyle Assistant Stage 1 Migration via DIRECT_URL...");

  const sqlPath = path.join(__dirname, "20261105_lifestyle_assistant_stage1.sql");
  const fullSql = fs.readFileSync(sqlPath, "utf8");

  // Split on semicolons that are not inside strings or statements
  // Or run statement groups
  const statements = [
    `CREATE TABLE IF NOT EXISTS "public"."knowledge_cards" (
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
    );`,

    `CREATE INDEX IF NOT EXISTS "knowledge_cards_domain_lang_is_active_idx" 
     ON "public"."knowledge_cards" ("domain", "lang", "is_active");`,

    `CREATE INDEX IF NOT EXISTS "knowledge_cards_layer_is_active_idx" 
     ON "public"."knowledge_cards" ("layer", "is_active");`,

    `CREATE TABLE IF NOT EXISTS "public"."knowledge_gaps" (
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
    );`,

    `CREATE INDEX IF NOT EXISTS "knowledge_gaps_status_created_at_idx" 
     ON "public"."knowledge_gaps" ("status", "created_at");`,

    `ALTER TABLE "public"."User" 
      ADD COLUMN IF NOT EXISTS "assistant_beta" BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "health_consent_version" INTEGER,
      ADD COLUMN IF NOT EXISTS "adult_confirmed_at" TIMESTAMPTZ(6),
      ADD COLUMN IF NOT EXISTS "special_groups" JSONB NOT NULL DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS "review_time" TEXT DEFAULT '20:30',
      ADD COLUMN IF NOT EXISTS "next_review_at" TIMESTAMPTZ(6);`,

    `CREATE INDEX IF NOT EXISTS "User_next_review_at_idx" 
     ON "public"."User" ("next_review_at");`,

    `ALTER TABLE "public"."AssistantMessage" 
      ADD COLUMN IF NOT EXISTS "prompt_version" TEXT,
      ADD COLUMN IF NOT EXISTS "used_card_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
      ADD COLUMN IF NOT EXISTS "model" TEXT;`,

    `UPDATE "public"."User"
     SET "assistant_beta" = true
     WHERE "start_param" ILIKE '%test_val%';`
  ];

  for (let i = 0; i < statements.length; i++) {
    console.log(`Executing step ${i + 1}/${statements.length}...`);
    await prisma.$executeRawUnsafe(statements[i]);
  }

  console.log("Checking beta users with assistant_beta = true...");
  const betaUsers: any[] = await prisma.$queryRawUnsafe(`
    SELECT id, email, start_param, assistant_beta
    FROM "public"."User"
    WHERE assistant_beta = true
  `);

  console.log(`✅ Migration complete. Total assistant_beta users: ${betaUsers.length}`);
  betaUsers.forEach(u => {
    console.log(` - ID: ${u.id} (start_param: ${u.start_param})`);
  });

  await prisma.$disconnect();
}

main().catch(err => {
  console.error("Migration error:", err);
  process.exit(1);
});
