import dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: ".env.local", override: true });

if (process.env.DATABASE_URL) {
  process.env.DATABASE_URL = process.env.DATABASE_URL + (process.env.DATABASE_URL.includes('?') ? '&' : '?') + 'connection_limit=2&pool_timeout=40';
}

import prisma from "../src/lib/prisma";

async function run() {
  const users = await prisma.user.findMany({ take: 5, select: { id: true, telegram_id: true, email: true } });
  console.log(users);
}
run().finally(() => process.exit(0));
