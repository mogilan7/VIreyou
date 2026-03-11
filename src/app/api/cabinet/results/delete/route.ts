import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { resultId, testType } = body;

        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        let result;

        if (resultId) {
            // Delete specific result by ID
            // @ts-ignore
            result = await prisma.test_results.deleteMany({
                where: {
                    id: resultId,
                    user_id: user.id
                }
            });
        } else if (testType) {
            // Delete all results of a specific type for the user
            // @ts-ignore
            result = await prisma.test_results.deleteMany({
                where: {
                    test_type: testType,
                    user_id: user.id
                }
            });
        } else {
            return NextResponse.json({ error: 'Missing resultId or testType' }, { status: 400 });
        }

        if (result.count === 0) {
            return NextResponse.json({ error: 'No results found to delete' }, { status: 404 });
        }

        return NextResponse.json({ success: true, count: result.count });
    } catch (error: any) {
        console.error('API Delete Result Error:', error);
        return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
    }
}
