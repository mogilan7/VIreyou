import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    const results: any = {};

    // 1. Get all auth users
    const { data: authData } = await supabaseAdmin.auth.admin.listUsers();
    const authUsers = authData?.users || [];
    results.authUserCount = authUsers.length;

    // 2. For each auth user, check if Prisma user has matching ID
    const mismatches = [];
    for (const authUser of authUsers) {
      const authId = authUser.id;
      const authEmail = authUser.email;
      if (!authEmail) continue;

      // Find Prisma user by email
      const prismaUser = await prisma.user.findFirst({ where: { email: authEmail }, select: { id: true, email: true } });
      if (prismaUser && prismaUser.id !== authId) {
        mismatches.push({ email: authEmail, prismaId: prismaUser.id, correctId: authId });
      }
    }
    results.mismatches = mismatches;

    // 3. Fix all mismatches
    const fixed = [];
    for (const m of mismatches) {
      try {
        // Check if correct ID already exists
        const existing = await prisma.user.findUnique({ where: { id: m.correctId } });
        if (existing) {
          // Already exists with correct ID, just copy subscription data if needed
          fixed.push({ email: m.email, action: 'already_exists_with_correct_id' });
        } else {
          // Update the primary key via raw SQL
          await prisma.$executeRawUnsafe(`UPDATE "User" SET id = '${m.correctId}' WHERE id = '${m.prismaId}'`);
          fixed.push({ email: m.email, oldId: m.prismaId, newId: m.correctId, action: 'id_updated' });
        }
      } catch (e: any) {
        fixed.push({ email: m.email, error: e.message });
      }
    }
    results.fixed = fixed;

    // 4. Also update subscription for mogilev.andrey@gmail.com specifically
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    const subUpdate = await prisma.user.updateMany({
      where: { email: 'mogilev.andrey@gmail.com' },
      data: { subscription_expires_at: expiresAt }
    });
    results.subscriptionUpdate = subUpdate;

    return NextResponse.json({ success: true, ...results });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message, stack: err.stack }, { status: 500 });
  }
}
