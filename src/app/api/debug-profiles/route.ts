import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const url = process.env.DATABASE_URL || '';
        const host = url.split('@')[1]?.split(':')[0] || 'unknown';

        // Fetch from both schemas
        const authUsers = await prisma.users.findMany().catch(() => []);
        const publicProfiles = await prisma.profiles.findMany().catch(() => []);

        return NextResponse.json({
            success: true,
            dbHost: host,
            authUsersCount: authUsers.length,
            profilesCount: publicProfiles.length,
            profiles: publicProfiles.map((p: any) => ({ id: p.id, full_name: p.full_name, role: p.role }))
        });
    } catch (error: any) {
        return NextResponse.json({
            success: false,
            error: error.message || error
        });
    }
}


