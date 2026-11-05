import dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: ".env.local", override: true });

import { PrismaClient } from "@prisma/client";

async function getDirectPrismaClient(): Promise<PrismaClient> {
  const directUrl = (process.env.DIRECT_URL || "").trim();
  const dbUrl = (process.env.DATABASE_URL || "").trim();

  // Try directUrl first; if not connecting, use session pooler port 5432
  const candidateUrls: string[] = [];
  if (directUrl) candidateUrls.push(directUrl);
  if (dbUrl) {
    const sessionUrl = dbUrl
      .replace(":6543", ":5432")
      .replace("?pgbouncer=true", "")
      .replace("&pgbouncer=true", "");
    candidateUrls.push(sessionUrl);
  }

  for (const url of candidateUrls) {
    const p = new PrismaClient({ datasourceUrl: url });
    try {
      await p.$queryRawUnsafe("SELECT 1");
      const host = url.split("@")[1]?.split("/")[0] || "unknown";
      console.log(`Connected successfully to ${host}`);
      return p;
    } catch {
      await p.$disconnect();
    }
  }

  throw new Error("Unable to establish direct database connection");
}

async function main() {
  const prisma = await getDirectPrismaClient();

  try {
    console.log("\n=== Checking rows for UPDATE assistant_beta (expecting 4) ===");
    const preCheck: any[] = await prisma.$queryRawUnsafe(`
      SELECT id, start_param 
      FROM "public"."User" 
      WHERE start_param ILIKE $1
    `, "%test_val%");

    console.log(`Pre-check count: ${preCheck.length}`);
    preCheck.forEach(u => console.log(` - ${u.id} (${u.start_param})`));

    if (preCheck.length !== 4) {
      console.warn(`⚠️ Warning: Expected 4 users with test_val, found ${preCheck.length}`);
    }

    console.log("\n=== Executing Stage 1 Migration in a SINGLE TRANSACTION (prisma.$transaction) ===");

    const statements = [
      // 1. Create knowledge_cards table
      `CREATE TABLE IF NOT EXISTS "public"."knowledge_cards" (
          "id" TEXT NOT NULL,
          "layer" TEXT NOT NULL,
          "domain" TEXT NOT NULL,
          "claim" TEXT NOT NULL,
          "evidence_level" TEXT NOT NULL,
          "source_title" TEXT,
          "source_url" TEXT,
          "source_year" INTEGER,
          "contraindications" TEXT,
          "related_content" TEXT,
          "lang" TEXT NOT NULL DEFAULT 'ru',
          "reviewed_at" TIMESTAMPTZ(6),
          "status" TEXT NOT NULL DEFAULT 'draft',
          "is_active" BOOLEAN NOT NULL DEFAULT false,
          "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "knowledge_cards_pkey" PRIMARY KEY ("id")
      );`,

      `CREATE INDEX IF NOT EXISTS "knowledge_cards_domain_lang_is_active_idx" 
       ON "public"."knowledge_cards" ("domain", "lang", "is_active");`,

      `CREATE INDEX IF NOT EXISTS "knowledge_cards_layer_is_active_idx" 
       ON "public"."knowledge_cards" ("layer", "is_active");`,

      // 2. Create knowledge_gaps table
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

      // 3. Extend User table
      `ALTER TABLE "public"."User" 
          ADD COLUMN IF NOT EXISTS "assistant_beta" BOOLEAN NOT NULL DEFAULT false,
          ADD COLUMN IF NOT EXISTS "health_consent_version" INTEGER,
          ADD COLUMN IF NOT EXISTS "health_consent_given_at" TIMESTAMPTZ(6),
          ADD COLUMN IF NOT EXISTS "adult_confirmed_at" TIMESTAMPTZ(6),
          ADD COLUMN IF NOT EXISTS "special_groups" JSONB NOT NULL DEFAULT '[]'::jsonb,
          ADD COLUMN IF NOT EXISTS "review_time" TEXT DEFAULT '20:30',
          ADD COLUMN IF NOT EXISTS "next_review_at" TIMESTAMPTZ(6);`,

      `CREATE INDEX IF NOT EXISTS "User_next_review_at_idx" 
       ON "public"."User" ("next_review_at");`,

      // 4. Extend AssistantMessage table
      `ALTER TABLE "public"."AssistantMessage" 
          ADD COLUMN IF NOT EXISTS "prompt_version" TEXT,
          ADD COLUMN IF NOT EXISTS "used_card_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
          ADD COLUMN IF NOT EXISTS "model" TEXT;`,

      // 5. Backfill assistant_beta for test_val users
      `UPDATE "public"."User"
       SET "assistant_beta" = true
       WHERE "start_param" ILIKE '%test_val%';`
    ];

    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < statements.length; i++) {
        console.log(`Executing transaction statement ${i + 1}/${statements.length}...`);
        await tx.$executeRawUnsafe(statements[i]);
      }
    }, { timeout: 30000 });

    console.log("✅ Transaction committed successfully.");

    console.log("\n=== Verifying information_schema (table and column names only) ===");
    
    // Check tables
    const tables: any[] = await prisma.$queryRawUnsafe(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' 
        AND table_name IN ('knowledge_cards', 'knowledge_gaps')
      ORDER BY table_name;
    `);
    console.log("Created tables in public schema:", tables.map(t => t.table_name));

    // Check knowledge_cards columns
    const kcCols: any[] = await prisma.$queryRawUnsafe(`
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'knowledge_cards'
      ORDER BY ordinal_position;
    `);
    console.log("knowledge_cards columns:", kcCols.map(c => `${c.column_name} (${c.data_type}, default: ${c.column_default}, nullable: ${c.is_nullable})`));

    // Check knowledge_gaps columns
    const kgCols: any[] = await prisma.$queryRawUnsafe(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'knowledge_gaps'
      ORDER BY ordinal_position;
    `);
    console.log("knowledge_gaps columns:", kgCols.map(c => `${c.column_name} (${c.data_type})`));

    // Check new User columns
    const userCols: any[] = await prisma.$queryRawUnsafe(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' 
        AND table_name = 'User'
        AND column_name IN ('assistant_beta', 'health_consent_version', 'health_consent_given_at', 'adult_confirmed_at', 'special_groups', 'review_time', 'next_review_at')
      ORDER BY column_name;
    `);
    console.log("New User columns:", userCols.map(c => `${c.column_name} (${c.data_type})`));

    // Check AssistantMessage columns
    const msgCols: any[] = await prisma.$queryRawUnsafe(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' 
        AND table_name = 'AssistantMessage'
        AND column_name IN ('prompt_version', 'used_card_ids', 'model')
      ORDER BY column_name;
    `);
    console.log("New AssistantMessage columns:", msgCols.map(c => `${c.column_name} (${c.data_type})`));

    console.log("\n=== Checking users with assistant_beta = true (IDs and count) ===");
    const betaUsers: any[] = await prisma.$queryRawUnsafe(`
      SELECT id, start_param, assistant_beta
      FROM "public"."User"
      WHERE assistant_beta = true
      ORDER BY id;
    `);

    console.log(`Total users with assistant_beta = true: ${betaUsers.length}`);
    betaUsers.forEach(u => console.log(` - ID: ${u.id} (start_param: ${u.start_param})`));

  } catch (err) {
    console.error("❌ Migration error occurred (automatically rolled back by prisma.$transaction):", err);
    throw err;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});
