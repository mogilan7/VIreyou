import { PrismaClient } from '@prisma/client';

export default async function DebugGrantPage() {
    const prisma = new PrismaClient();
    let res = "";
    try {
        await prisma.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public TO authenticated, anon;`);
        await prisma.$executeRawUnsafe(`GRANT ALL ON TABLE test_results TO authenticated, anon;`);
        await prisma.$executeRawUnsafe(`GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated, anon;`);
        res = "Success! Permissions granted on all statements.";
    } catch (e: any) {
        res = `Error: ${e.message}`;
    } finally {
        await prisma.$disconnect();
    }

    return (
        <div className="p-10 font-mono pt-32 text-slate-800">
            <h1 className="text-xl font-bold mb-4">Database Grant Trigger</h1>
            <div className="p-4 bg-slate-100 rounded-xl">
                {res}
            </div>
        </div>
    );
}
