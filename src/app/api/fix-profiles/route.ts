import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const authUsers = await prisma.users.findMany();
        let insertedCount = 0;

        for (const user of authUsers) {
            const meta = user.raw_user_meta_data as any;
            const fullName = meta?.full_name || meta?.name || null;

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
                        full_name: fullName,
                        created_at: new Date()
                    }
                });
                insertedCount++;
            } else if (!existingProfile.full_name && fullName) {
                // Update missing name on existing profile
                await prisma.profiles.update({
                    where: { id: user.id },
                    data: { full_name: fullName }
                });
                insertedCount++; // reuse counter for updated/synced profiles
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
