import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
  const profiles = await prisma.profiles.findMany({
    select: {
      id: true,
      full_name: true,
      role: true,
    }
  });

  console.log(`Total profiles found: ${profiles.length}`);
  profiles.forEach(p => {
    console.log(`- ID: ${p.id} | Name: ${p.full_name} | Role: ${p.role}`);
  });
  
  await prisma.$disconnect();
}

check().catch(e => {
  console.error(e);
  process.exit(1);
});
