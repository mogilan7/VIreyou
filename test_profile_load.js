const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    const profile = await prisma.profiles.findFirst({
         where: { full_name: { contains: "Могилев" } }
    });
    console.log("Welcome Data for Могилев:", profile?.welcome_data);
    console.log("Full profile row:", JSON.stringify(profile, null, 2));
  } catch (e) {
    console.error("Test Error:", e);
  } finally {
    await prisma.$disconnect();
  }
}
run();
