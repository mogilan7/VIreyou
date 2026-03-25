const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const userId = '563938a6-2ca7-44db-9604-d60673b56c08'; // From previous log inspection

  const results = await prisma.test_results.findMany({
    where: { user_id: userId },
    orderBy: { created_at: 'desc' }
  });

  const aiRecs = results.filter(r => r.test_type === 'ai-recommendation');
  const latestAiRec = aiRecs.length > 0 ? aiRecs[0] : null;
  
  if (!latestAiRec) {
      console.log("No AI Recommendation found for user.");
      return;
  }

  const recommendedTests = latestAiRec.raw_data?.recommendedTests || [];
  console.log("Recommended Tests:", recommendedTests);

  const completed = recommendedTests.filter(tid => results.some(r => r.test_type === tid));
  console.log("Completed Tests (Matched):", completed);
  
  console.log("\nAll passed tests in DB:");
  results.forEach(r => console.log(`- ${r.test_type} (${r.created_at})`));
}

main().catch(console.error).finally(() => prisma.$disconnect());
