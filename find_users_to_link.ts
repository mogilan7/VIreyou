import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const targetEmail = 'comfprorf@gmail.com';
  const telegramUsername = 'ergomarket_support';

  console.log(`Searching for email: ${targetEmail}...`);
  const emailUser = await prisma.user.findUnique({
    where: { email: targetEmail }
  });

  console.log(`Searching for telegram user: ${telegramUsername}...`);
  const tgUser = await prisma.user.findFirst({
    where: {
      OR: [
        { telegram_username: telegramUsername },
        { telegram_username: `@${telegramUsername}` }
      ]
    }
  });

  if (emailUser) {
    console.log('--- Email User Found ---');
    console.log(`ID: ${emailUser.id}, Email: ${emailUser.email}, TG ID: ${emailUser.telegram_id}`);
  } else {
    console.log('Email user not found');
  }

  if (tgUser) {
    console.log('--- Telegram User Found ---');
    console.log(`ID: ${tgUser.id}, Email: ${tgUser.email}, TG ID: ${tgUser.telegram_id}, TG Username: ${tgUser.telegram_username}`);
  } else {
    console.log('Telegram user not found');
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
