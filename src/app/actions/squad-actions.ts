'use server';

import { createClient } from '@/utils/supabase/server';
import prisma from '@/lib/prisma';
import { createSquad, removeParticipant } from '@/lib/squads/squadService';
import { revalidatePath } from 'next/cache';

export async function createSquadAction() {
    const supabase = await createClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) throw new Error('Unauthorized');

    const user = await prisma.user.findUnique({
        where: { email: authUser.email || undefined },
    });

    if (!user) throw new Error('User not found');

    const squadCount = await prisma.squad.count({ where: { creator_id: user.id } });
    const squadName = `Марафон #${squadCount + 1} (${user.full_name || 'Участник'})`;
    
    await createSquad(user.id, squadName);
    
    revalidatePath('/[locale]/cabinet/squads', 'page');
    return { success: true };
}

export async function removeParticipantAction(squadId: string, participantId: string) {
    const supabase = await createClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) throw new Error('Unauthorized');

    const user = await prisma.user.findUnique({
        where: { email: authUser.email || undefined },
    });

    if (!user) throw new Error('User not found');

    // Security check: Only creator can remove
    const squad = await prisma.squad.findUnique({ where: { id: squadId } });
    if (!squad || squad.creator_id !== user.id) {
        throw new Error('Only the creator can remove participants');
    }

    await removeParticipant(squadId, participantId);
    
    revalidatePath('/[locale]/cabinet/squads', 'page');
    return { success: true };
}
