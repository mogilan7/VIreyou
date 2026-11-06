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

    const dbUser = await prisma.user.findUnique({
        where: { id: authUser.id }
    });

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

