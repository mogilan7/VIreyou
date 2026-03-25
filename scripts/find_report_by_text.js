const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const results = await prisma.test_results.findMany({
    where: { test_type: 'ai-recommendation' },
    orderBy: { created_at: 'desc' },
    take: 10
  });

  console.log("Found", results.length, "recommendations");
  results.forEach(r => {
      const data = r.raw_data || {};
      const rec = data.recommendedTests || [];
      console.log(`User: ${r.user_id}, Date: ${r.created_at}, Recs: ${JSON.stringify(rec)}`);
      // Dump text to match
      const interp = r.interpretation || "";
      if (interp.includes("Дорожная карта")) {
          console.log(">>> MATCH FOUND FOR USER:", r.user_id);
          console.log("Report Interpretation Preview:", interp.substring(0, 100));
      }
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
