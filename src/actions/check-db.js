require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const result = await prisma.$queryRaw`
      SELECT pg_get_constraintdef(con.oid) 
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      WHERE con.conname = 'test_results_test_type_check';
    `;
    console.log("Constraint definition:", result);
  } catch (err) {
    console.error("Query Error:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
