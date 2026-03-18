import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const profiles = await prisma.profiles.findMany();
        return NextResponse.json({
            success: true,
            count: profiles.length,
            profiles: profiles.map(p => ({ id: p.id, full_name: p.full_name, role: p.role }))
        });
    } catch (error: any) {
        return NextResponse.json({
            success: false,
            error: error.message || error
        });
    }
}
