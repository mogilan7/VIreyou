
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://postgres.yqdiqyyvbrjpidtabryw:6QyYnu88X5gohLV@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres" 
    },
  },
});

async function main() {
  console.log('Adding "gender" column to "profiles" table...');
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "public"."profiles" ADD COLUMN IF NOT EXISTS "gender" TEXT;`);
    console.log('Column "gender" added successfully!');
  } catch (e) {
    console.error('Error adding column:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
