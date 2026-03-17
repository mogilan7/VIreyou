const { PrismaClient } = require('@prisma/client');

async function test() {
    const prisma = new PrismaClient({
        datasources: {
            db: { url: "postgresql://postgres:6QyYnu88X5gohLV@db.yqdiqyyvbrjpidtabryw.supabase.co:5432/postgres" }
        }
    });
    try {
        console.log("Connecting...");
        const res = await prisma.$queryRaw`SELECT 1 as result`;
        console.log("Success:", res);
    } catch (e) {
        console.error("Error:", e.message);
    } finally {
        await prisma.$disconnect();
    }
}
test();
