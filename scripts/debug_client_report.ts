import prisma from "../src/lib/prisma";

async function main() {
    const clients = await prisma.profiles.findMany({
        where: {
            full_name: {
                contains: "Короткова",
                mode: 'insensitive' as any
            }
        }
    });

    console.log("--- КЛИЕНТЫ КОРОТКОВА ---");
    for (const c of clients) {
        console.log(`Profile: ${c.full_name} (ID: ${c.id})`);
        const uById = await prisma.user.findUnique({ where: { id: c.id } });
        console.log(`User by ID: ${uById ? uById.full_name : 'not found'}`);
        
        const authUser = await prisma.users.findUnique({ where: { id: c.id } });
        console.log(`Auth User Email: ${authUser ? authUser.email : 'not found'}`);
        if (authUser?.email) {
            const uByEmail = await prisma.user.findUnique({ where: { email: authUser.email } });
            console.log(`User by Email: ${uByEmail ? uByEmail.full_name : 'not found'}`);
        }
    }

    const clients2 = await prisma.profiles.findMany({
        where: {
            full_name: {
                contains: "Иван",
                mode: 'insensitive' as any
            }
        }
    });

    console.log("\n--- КЛИЕНТЫ ИВАН ---");
    for (const c of clients2) {
        console.log(`Profile: ${c.full_name} (ID: ${c.id})`);
        const uById = await prisma.user.findUnique({ where: { id: c.id } });
        console.log(`User by ID: ${uById ? uById.full_name : 'not found'}`);
        
        const authUser = await prisma.users.findUnique({ where: { id: c.id } });
        console.log(`Auth User Email: ${authUser ? authUser.email : 'not found'}`);
        if (authUser?.email) {
            const uByEmail = await prisma.user.findUnique({ where: { email: authUser.email } });
            console.log(`User by Email: ${uByEmail ? uByEmail.full_name : 'not found'}`);
        }
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
