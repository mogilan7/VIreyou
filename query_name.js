const fs = require('fs');
const path = require('path');

try {
    const envPath = path.join(__dirname, '.env.local');
    if (fs.existsSync(envPath)) {
        const env = fs.readFileSync(envPath, 'utf-8');
        env.split('\n').forEach(line => {
            const [key, ...rest] = line.split('=');
            if (key && rest.length > 0) {
                process.env[key.trim()] = rest.join('=').trim().replace(/^"|"$/g, '');
            }
        });
    }
} catch (e) {
    console.warn("Could not load .env.local:", e.message);
}

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    try {
        console.log("--- Prisma Profiles Debug ---");
        const prismaProfiles = await prisma.profiles.findMany();
        console.log("Total Profiles in DB:", prismaProfiles.length);
        
        prismaProfiles.forEach(p => {
             console.log(`[Prisma] ID: ${p.id} -> Name: ${p.full_name}`);
        });

    } catch (e) {
        console.error("Crash:", e);
    } finally {
        await prisma.$disconnect();
    }
}

run();
