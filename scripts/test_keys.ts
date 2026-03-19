import prisma from "../src/lib/prisma";

console.log("Доступные модели в Prisma:");
const keys = Object.keys(prisma).filter(k => !k.startsWith('_') && typeof (prisma as any)[k] === 'object');
console.log(keys);
process.exit(0);
