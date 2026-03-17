const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

async function checkError() {
    let dbUrl = "postgresql://postgres:6QyYnu88X5gohLV@db.yqdiqyyvbrjpidtabryw.supabase.co:6543/postgres";

    if (!dbUrl) {
        console.error('No DIRECT_URL found in env or .env.local');
        return;
    }

    console.log('Using DB URL:', dbUrl);

    const prisma = new PrismaClient({
        datasources: {
            db: {
                url: dbUrl
            }
        }
    });

    try {
        console.log('Connecting to database...');
        
        const sql = `
            GRANT USAGE ON SCHEMA public TO authenticated, anon;
            GRANT ALL ON TABLE test_results TO authenticated, anon;
            GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated, anon;
        `;
        
        const count = await prisma.$executeRawUnsafe(sql);
        console.log('GRANT successful! Rows affected:', count);
    } catch (e) {
        console.error('Prisma Error:', e.message);
    } finally {
        await prisma.$disconnect();
    }
}

checkError();
