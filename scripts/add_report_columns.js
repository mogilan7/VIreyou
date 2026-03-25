const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const queries = [
    `ALTER TABLE "public"."User" ADD COLUMN IF NOT EXISTS "report_period_days" INTEGER DEFAULT 7`,
    `ALTER TABLE "public"."User" ADD COLUMN IF NOT EXISTS "last_report_date" TIMESTAMP WITH TIME ZONE`
  ];

  try {
    console.log("Starting column addition for User table...");
    for (const q of queries) {
        console.log(`Executing: ${q}`);
        await prisma.$executeRawUnsafe(q);
    }
    console.log("✅ Report setting columns added successfully!");
  } catch (e) {
    console.error("❌ Crash during ALTER TABLE:", e);
  } finally {
    await prisma.$disconnect();
  }
}
run();
