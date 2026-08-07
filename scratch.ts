import { PrismaClient } from '@prisma/client';
import { aggregateUserContext } from './src/lib/assistant/context';

const prisma = new PrismaClient();

async function main() {
    const userId = "dc39e0c0-8016-4ca6-8a80-17e1950b6b6a";
    console.log("Fetching context for user:", userId);
    const context = await aggregateUserContext(userId, 7);
    console.log(JSON.stringify(context, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
