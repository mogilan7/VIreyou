import { PrismaClient } from '@prisma/client';

const prismaClientSingleton = () => {
    let url = process.env.DATABASE_URL || '';
    if (typeof window === 'undefined') {
        url = url.trim();
        const host = url.split('@')[1]?.split(':')[0] || 'unknown';
        const port = url.split(':')[3]?.split('/')[0] || 'unknown';
        console.log(`[PRISMA INIT] Database Host: ${host}, Port: ${port}`);
    }
    return new PrismaClient({
        datasourceUrl: url.trim(),
    });
};

declare global {
    var prisma: undefined | ReturnType<typeof prismaClientSingleton>;
}

const prisma = globalThis.prisma ?? prismaClientSingleton();

export default prisma;

if (process.env.NODE_ENV !== 'production') globalThis.prisma = prisma;
