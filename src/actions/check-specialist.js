const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: "postgresql://postgres:6QyYnu88X5gohLV@db.yqdiqyyvbrjpidtabryw.supabase.co:5432/postgres"
        }
    }
});

async function main() {
    const user = await prisma.users.findFirst({
        where: { email: 'cleverval23@gmail.com' }
    });
    console.log(JSON.stringify(user, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
