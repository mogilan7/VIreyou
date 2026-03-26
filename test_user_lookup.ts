import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const email = 'cleverval23@gmail.com';
  
  console.log("Checking email:", email);
  const userInsensitive = await prisma.user.findFirst({ 
    where: { email: { equals: email, mode: 'insensitive' } } 
  });
  console.log("Found user (insensitive):", userInsensitive);
  
  const userUnique = await prisma.user.findUnique({ 
    where: { email: email.trim() } 
  });
  console.log("Found user (Unique):", userUnique);

  const allUsers = await prisma.user.findMany({
    take: 10,
    select: { email: true }
  });
  console.log("\nLast 10 users in DB:");
  allUsers.forEach(u => console.log(`- ${u.email}`));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
