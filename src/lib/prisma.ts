import { PrismaClient } from '@prisma/client';

const prismaClientSingleton = () => {
    if (typeof window === 'undefined') {
        const url = process.env.DATABASE_URL || '';
        const host = url.split('@')[1]?.split(':')[0] || 'unknown';
        const port = url.split(':')[3]?.split('/')[0] || 'unknown';
        console.log(`[PRISMA INIT] Database Host: ${host}, Port: ${port}`);
    }
    return new PrismaClient();
};

declare global {
    var prisma: undefined | ReturnType<typeof prismaClientSingleton>;
}

const prisma = globalThis.prisma ?? prismaClientSingleton();

export default prisma;

if (process.env.NODE_ENV !== 'production') globalThis.prisma = prisma;
