import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
async function main() {
  // Delete all foods with null vitamin_K1 so they get re-analyzed with K1/K2 next time
  const deleted = await p.foodItem.deleteMany({
    where: { vitamin_K1: null }
  });
  console.log(`Deleted ${deleted.count} cached food items without K1/K2 data`);
}
main().catch(console.error).finally(() => p.$disconnect());
