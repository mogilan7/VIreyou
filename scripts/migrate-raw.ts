import dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: ".env.local", override: true });

if (process.env.DATABASE_URL) {
  process.env.DATABASE_URL = process.env.DATABASE_URL + (process.env.DATABASE_URL.includes('?') ? '&' : '?') + 'connection_limit=2&pool_timeout=40';
}

import prisma from "../src/lib/prisma";

async function run() {
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "public"."User" ADD COLUMN IF NOT EXISTS "wake_up_time" TEXT DEFAULT '07:00';`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "public"."User" ADD COLUMN IF NOT EXISTS "target_steps" INTEGER;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "public"."User" ADD COLUMN IF NOT EXISTS "target_active_minutes" INTEGER;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "public"."SleepLog" ADD COLUMN IF NOT EXISTS "subjective_quality" TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "public"."SleepLog" ADD COLUMN IF NOT EXISTS "end_time" TIMESTAMP(3);`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "public"."DomainBaseline" ADD COLUMN IF NOT EXISTS "is_outdated" BOOLEAN NOT NULL DEFAULT false;`);
    
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "public"."HabitEpisode" (
          "id" TEXT NOT NULL,
          "user_id" TEXT NOT NULL,
          "habit_key" TEXT NOT NULL,
          "occurred_at" TIMESTAMP(3) NOT NULL,
          "quantity" DOUBLE PRECISION,
          "unit" TEXT,
          "note" TEXT,
          CONSTRAINT "HabitEpisode_pkey" PRIMARY KEY ("id")
      );
    `);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "HabitEpisode_user_id_habit_key_occurred_at_idx" ON "public"."HabitEpisode"("user_id", "habit_key", "occurred_at");`);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "public"."AssistantState" (
          "id" TEXT NOT NULL,
          "userId" TEXT NOT NULL,
          "consecutiveEmptyDays" INTEGER NOT NULL DEFAULT 0,
          "lastPingAt" TIMESTAMP(3),
          "updatedAt" TIMESTAMP(3) NOT NULL,
          CONSTRAINT "AssistantState_pkey" PRIMARY KEY ("id")
      );
    `);
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "AssistantState_userId_key" ON "public"."AssistantState"("userId");`);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "public"."ConsultantLog" (
          "id" TEXT NOT NULL,
          "userId" TEXT NOT NULL,
          "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "event_type" TEXT NOT NULL,
          "requested_period" INTEGER,
          "valid_days" INTEGER,
          "coverage" DOUBLE PRECISION,
          "shown_values" JSONB,
          "flags" JSONB,
          "explicit_consent" BOOLEAN NOT NULL DEFAULT false,
          CONSTRAINT "ConsultantLog_pkey" PRIMARY KEY ("id")
      );
    `);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ConsultantLog_userId_date_idx" ON "public"."ConsultantLog"("userId", "date");`);
    
    console.log("Migration applied successfully!");
  } catch (err) {
    console.error("Migration failed:", err);
  }
}

run().finally(() => process.exit(0));
