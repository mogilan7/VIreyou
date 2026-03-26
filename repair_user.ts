import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const email = 'cleverval23@gmail.com';
  
  // 1. Извлекаем данные из auth.users
  const authUser = await prisma.users.findFirst({ 
    where: { email: { equals: email, mode: 'insensitive' } } 
  });

  if (!authUser) {
    console.error(`Пользователь ${email} не найден даже в таблице auth.users.`);
    return;
  }

  // Извлекаем имя из метаданных, если оно есть
  const metadata = authUser.raw_user_meta_data as any;
  const fullName = metadata?.full_name || 'клиент';

  // 2. Создаем запись в public.User
  const existingPublic = await prisma.user.findUnique({ where: { email: authUser.email as string } });
  if (existingPublic) {
    console.log(`Пользователь ${email} уже существует в public.User.`);
    return;
  }

  const newPublicUser = await prisma.user.create({
    data: {
      email: authUser.email as string,
      role: 'client',
      full_name: fullName,
    }
  });

  console.log(`✅ Успешно синхронизирован пользователь ${email} из auth.users в public.User`);
  console.log(newPublicUser);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
