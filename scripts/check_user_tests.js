const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const userId = 'e06c66a2-3a5b-4796-aca0-7684f5f6c40e';

  const results = await prisma.test_results.findMany({
    where: { user_id: userId },
    orderBy: { created_at: 'desc' }
  });

  console.log("Passed Tests for user e06c66a2-3a5b-4796-aca0-7684f5f6c40e:");
  results.forEach(r => console.log(`- ${r.test_type} (score: ${r.score})`));

  console.log("\nMatching Logic Debug:");
  const recommended = ["systemic-bio-age","alcohol","insomnia","circadian"];
  recommended.forEach(tid => {
      const match = results.some(r => r.test_type === tid);
      console.log(`Test: ${tid} -> Matched: ${match}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
