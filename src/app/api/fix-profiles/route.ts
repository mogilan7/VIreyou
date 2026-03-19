import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const authUsers = await prisma.users.findMany();
        let insertedCount = 0;

        for (const user of authUsers) {
            // Check if profile exists
            const existingProfile = await prisma.profiles.findUnique({
                where: { id: user.id }
            });

            if (!existingProfile) {
                // Create profile row backfill
                await prisma.profiles.create({
                    data: {
                        id: user.id,
                        role: 'client', // Default role
                        created_at: new Date()
                    }
                });
                insertedCount++;
            }
        }

        return NextResponse.json({
            success: true,
            totalUsersFound: authUsers.length,
            profilesCreated: insertedCount
        });
        
    } catch (error: any) {
        return NextResponse.json({
            success: false,
            error: error.message || error
        });
    }
}
