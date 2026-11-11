'use server';

import prisma from '@/lib/prisma';
import { createSquad, removeParticipant } from '@/lib/squads/squadService';
import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth/guards';

export async function createSquadAction() {
    const user = await requireUser();

    const squadCount = await prisma.squad.count({ where: { creator_id: user.id } });
    const squadName = `Марафон #${squadCount + 1} (${user.full_name || 'Участник'})`;
    
    await createSquad(user.id, squadName);
    
    revalidatePath('/[locale]/cabinet/squads', 'page');
    return { success: true };
}

export async function removeParticipantAction(squadId: string, participantId: string) {
    const user = await requireUser();

    // Security check: Only creator can remove
    const squad = await prisma.squad.findUnique({ where: { id: squadId } });
    if (!squad || squad.creator_id !== user.id) {
        throw new Error('Only the creator can remove participants');
    }

    await removeParticipant(squadId, participantId, user.id);
    
    revalidatePath('/[locale]/cabinet/squads', 'page');
    return { success: true };
}
