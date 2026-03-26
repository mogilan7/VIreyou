const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("Добавление колонки timezone в таблицу public.User...");
  try {
    const result = await prisma.$executeRawUnsafe(
      `ALTER TABLE public."User" ADD COLUMN IF NOT EXISTS "timezone" TEXT DEFAULT 'Europe/Moscow'`
    );
    console.log("✅ Колонка успешно добавлена или уже существует.", result);
  } catch (error) {
    console.error("❌ Ошибка при выполнении SQL:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
