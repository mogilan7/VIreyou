const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  try {
    console.log('Adding columns to User table...');
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "User" 
      ADD COLUMN IF NOT EXISTS "gender" TEXT,
      ADD COLUMN IF NOT EXISTS "age" INTEGER,
      ADD COLUMN IF NOT EXISTS "weight" DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS "height" DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS "activity_level" TEXT,
      ADD COLUMN IF NOT EXISTS "goal" TEXT,
      ADD COLUMN IF NOT EXISTS "target_calories" DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS "target_protein" DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS "target_fat" DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS "target_carbs" DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS "telegram_username" TEXT;
    `);
    console.log('Success!');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
