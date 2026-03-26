import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const emailToFind = 'cleverval23@gmail.com';

  console.log("\n=== Checking 'public.User' table ===");
  const publicUsers = await prisma.user.findMany({ select: { id: true, email: true } });
  console.log(`Total public.User count: ${publicUsers.length}`);
  publicUsers.forEach(u => console.log(`- [${u.id}] ${u.email}`));

  console.log("\n=== Checking 'auth.users' table ===");
  // In Prisma, model 'users' maps to auth.users
  const authUsers = await prisma.users.findMany({ select: { id: true, email: true } });
  console.log(`Total auth.users count: ${authUsers.length}`);
  authUsers.forEach(u => console.log(`- [${u.id}] ${u.email}`));

  const matchAuth = authUsers.find(u => u.email?.toLowerCase() === emailToFind.toLowerCase());
  const matchPublic = publicUsers.find(u => u.email.toLowerCase() === emailToFind.toLowerCase());

  console.log(`\nResults for ${emailToFind}:`);
  console.log(`In auth.users:   ${matchAuth ? '✅ FOUND (' + matchAuth.id + ')' : '❌ NOT FOUND'}`);
  console.log(`In public.User:  ${matchPublic ? '✅ FOUND (' + matchPublic.id + ')' : '❌ NOT FOUND'}`);
  
  if (matchAuth && !matchPublic) {
    console.log("\n💡 HYPOTHESIS: User exists in Supabase Auth, but NOT in the custom public.User table!");
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
