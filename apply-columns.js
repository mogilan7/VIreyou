const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const queries = [
    `ALTER TABLE "public"."NutritionLog" ADD COLUMN IF NOT EXISTS "dish" TEXT`,
    `ALTER TABLE "public"."NutritionLog" ADD COLUMN IF NOT EXISTS "grams" DOUBLE PRECISION`,
    `ALTER TABLE "public"."NutritionLog" ADD COLUMN IF NOT EXISTS "sugar_fast" DOUBLE PRECISION`,
    `ALTER TABLE "public"."NutritionLog" ADD COLUMN IF NOT EXISTS "trans_fat" DOUBLE PRECISION`,
    `ALTER TABLE "public"."NutritionLog" ADD COLUMN IF NOT EXISTS "cholesterol" DOUBLE PRECISION`,
    `ALTER TABLE "public"."NutritionLog" ADD COLUMN IF NOT EXISTS "added_sugar" DOUBLE PRECISION`,
    `ALTER TABLE "public"."NutritionLog" ADD COLUMN IF NOT EXISTS "omega_3" DOUBLE PRECISION`,
    `ALTER TABLE "public"."NutritionLog" ADD COLUMN IF NOT EXISTS "omega_6" DOUBLE PRECISION`,
    `ALTER TABLE "public"."NutritionLog" ADD COLUMN IF NOT EXISTS "water" DOUBLE PRECISION`,

    // Витамины
    `ALTER TABLE "public"."NutritionLog" ADD COLUMN IF NOT EXISTS "vitamin_A" DOUBLE PRECISION`,
    `ALTER TABLE "public"."NutritionLog" ADD COLUMN IF NOT EXISTS "vitamin_D" DOUBLE PRECISION`,
    `ALTER TABLE "public"."NutritionLog" ADD COLUMN IF NOT EXISTS "vitamin_E" DOUBLE PRECISION`,
    `ALTER TABLE "public"."NutritionLog" ADD COLUMN IF NOT EXISTS "vitamin_K" DOUBLE PRECISION`,
    `ALTER TABLE "public"."NutritionLog" ADD COLUMN IF NOT EXISTS "vitamin_B1" DOUBLE PRECISION`,
    `ALTER TABLE "public"."NutritionLog" ADD COLUMN IF NOT EXISTS "vitamin_B2" DOUBLE PRECISION`,
    `ALTER TABLE "public"."NutritionLog" ADD COLUMN IF NOT EXISTS "vitamin_B3" DOUBLE PRECISION`,
    `ALTER TABLE "public"."NutritionLog" ADD COLUMN IF NOT EXISTS "vitamin_B5" DOUBLE PRECISION`,
    `ALTER TABLE "public"."NutritionLog" ADD COLUMN IF NOT EXISTS "vitamin_B6" DOUBLE PRECISION`,
    `ALTER TABLE "public"."NutritionLog" ADD COLUMN IF NOT EXISTS "vitamin_B7" DOUBLE PRECISION`,
    `ALTER TABLE "public"."NutritionLog" ADD COLUMN IF NOT EXISTS "vitamin_B9" DOUBLE PRECISION`,
    `ALTER TABLE "public"."NutritionLog" ADD COLUMN IF NOT EXISTS "vitamin_B12" DOUBLE PRECISION`,
    `ALTER TABLE "public"."NutritionLog" ADD COLUMN IF NOT EXISTS "vitamin_C" DOUBLE PRECISION`,

    // Минералы
    `ALTER TABLE "public"."NutritionLog" ADD COLUMN IF NOT EXISTS "calcium" DOUBLE PRECISION`,
    `ALTER TABLE "public"."NutritionLog" ADD COLUMN IF NOT EXISTS "iron" DOUBLE PRECISION`,
    `ALTER TABLE "public"."NutritionLog" ADD COLUMN IF NOT EXISTS "magnesium" DOUBLE PRECISION`,
    `ALTER TABLE "public"."NutritionLog" ADD COLUMN IF NOT EXISTS "phosphorus" DOUBLE PRECISION`,
    `ALTER TABLE "public"."NutritionLog" ADD COLUMN IF NOT EXISTS "potassium" DOUBLE PRECISION`,
    `ALTER TABLE "public"."NutritionLog" ADD COLUMN IF NOT EXISTS "sodium" DOUBLE PRECISION`,
    `ALTER TABLE "public"."NutritionLog" ADD COLUMN IF NOT EXISTS "zinc" DOUBLE PRECISION`,
    `ALTER TABLE "public"."NutritionLog" ADD COLUMN IF NOT EXISTS "copper" DOUBLE PRECISION`,
    `ALTER TABLE "public"."NutritionLog" ADD COLUMN IF NOT EXISTS "manganese" DOUBLE PRECISION`,
    `ALTER TABLE "public"."NutritionLog" ADD COLUMN IF NOT EXISTS "selenium" DOUBLE PRECISION`,
    `ALTER TABLE "public"."NutritionLog" ADD COLUMN IF NOT EXISTS "iodine" DOUBLE PRECISION`
  ];

  try {
    console.log("Starting column addition...");
    for (const q of queries) {
        console.log(`Executing: ${q}`);
        await prisma.$executeRawUnsafe(q);
    }
    console.log("✅ All columns added successfully!");
  } catch (e) {
    console.error("❌ Crash during ALTER TABLE:", e);
  } finally {
    await prisma.$disconnect();
  }
}
run();
