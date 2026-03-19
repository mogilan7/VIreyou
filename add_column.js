const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    console.log("Executing raw SQL: ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS welcome_data jsonb;");
    await prisma.$executeRawUnsafe(`ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS welcome_data jsonb`);
    console.log("Column added successfully!");
  } catch (e) {
    if (e.message.includes('already exists')) {
       console.log("Column welcome_data already exists, skipping.");
    } else {
       console.error("Error executing SQL:", e);
    }
  } finally {
    await prisma.$disconnect();
  }
}
run();
