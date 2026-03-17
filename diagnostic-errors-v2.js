const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

async function checkError() {
    let dbUrl = process.env.DIRECT_URL;

    if (!dbUrl && fs.existsSync('.env.local')) {
        const env = fs.readFileSync('.env.local', 'utf8');
        const dmatch = env.match(/DIRECT_URL=(.*)/);
        if (dmatch) {
            dbUrl = dmatch[1].trim().replace(/"/g, '').replace(/'/g, '');
        }
    }

    if (!dbUrl) {
        console.error('No DIRECT_URL found in env or .env.local');
        return;
    }

    const prisma = new PrismaClient({
        datasources: {
            db: {
                url: dbUrl
            }
        }
    });

    try {
        console.log('Connecting to database...');
        
        // 1. Get a valid user
        const users = await prisma.users.findMany({ take: 1 });
        if (users.length === 0) {
            console.log('No users found in auth.users');
            return;
        }
        
        const userId = users[0].id;
        console.log(`Found user: ${userId}`);

        // 2. Attempt insert
        console.log('Attempting insert into test_results...');
        const result = await prisma.test_results.create({
            data: {
                user_id: userId,
                test_type: 'systemic-bio-age',
                score: 45,
                interpretation: 'Тестовая запись',
                raw_data: { test: 'data' }
            }
        });

        console.log('Insert successful! ID:', result.id);
        
        // Clean up mock
        await prisma.test_results.delete({ where: { id: result.id } });
        console.log('Cleaned up mock.');
    } catch (e) {
        console.error('Prisma Error:', e.message);
    } finally {
        await prisma.$disconnect();
    }
}

checkError();
