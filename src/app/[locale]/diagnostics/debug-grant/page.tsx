import { PrismaClient } from '@prisma/client';

export default async function DebugGrantPage() {
    const prisma = new PrismaClient();
    let res = "";
    try {
        await prisma.$executeRawUnsafe(`ALTER TABLE test_results DROP CONSTRAINT IF EXISTS test_results_test_type_check;`);
        await prisma.$executeRawUnsafe(`ALTER TABLE test_results ADD CONSTRAINT test_results_test_type_check CHECK (test_type = ANY (ARRAY['bio-age'::text, 'score'::text, 'circadian'::text, 'insomnia'::text, 'mini-cog'::text, 'RU-AUDIT'::text, 'nicotine'::text, 'energy'::text, 'sarc-f'::text, 'systemic-bio-age'::text, 'greene-scale'::text]));`);
        await prisma.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public TO authenticated, anon;`);
        await prisma.$executeRawUnsafe(`GRANT ALL ON TABLE test_results TO authenticated, anon;`);
        res = "Success! Database Check Constraint updated with 'greene-scale', and permissions granted.";
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
