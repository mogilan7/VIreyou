import { createClient } from '@/utils/supabase/server';
import prisma from '@/lib/prisma';

/**
 * Ensures the caller has a valid Supabase Auth session and a corresponding User record in Prisma.
 * Match is strictly performed by `id: authUser.id`.
 * Throws an Error if unauthenticated or record does not exist.
 */
export async function requireUser() {
    const supabase = await createClient();
    const { data: { user: authUser }, error } = await supabase.auth.getUser();

    if (error || !authUser) {
        throw new Error('Unauthorized: Authentication required');
    }

    let dbUser = await prisma.user.findUnique({
        where: { id: authUser.id }
    });

    if (!dbUser && authUser.email) {
        const emailLower = authUser.email.toLowerCase().trim();

        // 1. Refuse internal / synthetic bot email domain
        if (emailLower.endsWith('@vireyou.com')) {
            throw new Error('Unauthorized: invalid registration domain');
        }

        // 2. Only allow auto-creation if email was confirmed
        if (!authUser.email_confirmed_at) {
            throw new Error('Unauthorized: email confirmation required');
        }

        // 3. Prevent account hijacking: do NOT return someone else's record by email
        const conflictUser = await prisma.user.findUnique({
            where: { email: authUser.email }
        });
        if (conflictUser) {
            throw new Error('Account conflict: linking required');
        }

        dbUser = await prisma.user.create({
            data: {
                id: authUser.id,
                email: authUser.email,
                role: 'client',
                full_name: authUser.user_metadata?.full_name || 'Пользователь',
                balance: 0,
            }
        });
    }

    if (!dbUser) {
        throw new Error('Unauthorized: User record not found in database');
    }

    return dbUser;
}

/**
 * Ensures the caller is authenticated and holds one of the specified roles.
 * Example: `await requireRole('admin')` or `await requireRole('admin', 'specialist')`.
 */
export async function requireRole(...roles: string[]) {
    const dbUser = await requireUser();

    if (!roles.includes(dbUser.role)) {
        throw new Error(`Forbidden: insufficient permissions. Required: [${roles.join(', ')}]`);
    }

    return dbUser;
}

