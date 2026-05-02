import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  const username = 'ChemistMA';
  console.log(`Checking user: ${username}...`);
  
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { telegram_username: username },
        { telegram_username: `@${username}` }
      ]
    }
  });

  if (!user) {
    console.log(`User ${username} not found in database.`);
  } else {
    console.log('--- User Found ---');
    console.log(`ID: ${user.id}`);
    console.log(`Email: ${user.email}`);
    console.log(`Role: ${user.role}`);
    console.log(`Telegram Username: ${user.telegram_username}`);
    console.log(`Subscription Active: ${user.subscription_expires_at && user.subscription_expires_at > new Date()}`);
    console.log(`Subscription Expires: ${user.subscription_expires_at}`);
    console.log(`Balance: ${user.balance}`);
    console.log('------------------');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
