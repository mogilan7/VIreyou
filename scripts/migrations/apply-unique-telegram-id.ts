import dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: ".env.local", override: true });

import prisma from "../../src/lib/prisma";

async function main() {
  console.log("Checking for duplicate telegram_id before applying index...");
  const duplicates: any[] = await prisma.$queryRawUnsafe(`
    SELECT telegram_id, COUNT(*) as cnt
    FROM "User"
    WHERE telegram_id IS NOT NULL AND telegram_id != ''
    GROUP BY telegram_id
    HAVING COUNT(*) > 1;
  `);

  if (duplicates.length > 0) {
    console.error("❌ Cannot apply unique index: duplicates still exist in User.telegram_id!", duplicates);
    process.exit(1);
  }

  console.log("Applying unique index on User.telegram_id (WHERE telegram_id IS NOT NULL AND telegram_id != '')...");
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "User_telegram_id_unique_idx"
    ON "public"."User" ("telegram_id")
    WHERE "telegram_id" IS NOT NULL AND "telegram_id" != '';
  `);

  console.log("✅ Unique index 'User_telegram_id_unique_idx' applied successfully.");
  await prisma.$disconnect();
}

main().catch(console.error);
