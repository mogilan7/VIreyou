import prisma from "@/lib/prisma";

export async function mergeUserAccounts(
    tx: any,
    targetUserId: string,
    placeholderUserId: string
) {
    const targetUser = await tx.user.findUnique({ where: { id: targetUserId } });
    const placeholderUser = await tx.user.findUnique({ where: { id: placeholderUserId } });

    if (!targetUser || !placeholderUser) return targetUser;

    console.log(`[MERGE_TX] Merging placeholder ${placeholderUser.id} (${placeholderUser.email}) into target ${targetUser.id} (${targetUser.email})`);

    // 1. Simple 1-to-many logs & personal records
    await tx.nutritionLog.updateMany({ where: { user_id: placeholderUser.id }, data: { user_id: targetUser.id } });
    await tx.activityLog.updateMany({ where: { user_id: placeholderUser.id }, data: { user_id: targetUser.id } });
    await tx.habitLog.updateMany({ where: { user_id: placeholderUser.id }, data: { user_id: targetUser.id } });
    await tx.habitEpisode.updateMany({ where: { user_id: placeholderUser.id }, data: { user_id: targetUser.id } });
    await tx.sleepLog.updateMany({ where: { user_id: placeholderUser.id }, data: { user_id: targetUser.id } });
    await tx.hydrationLog.updateMany({ where: { user_id: placeholderUser.id }, data: { user_id: targetUser.id } });
    await tx.biomarkerResult.updateMany({ where: { user_id: placeholderUser.id }, data: { user_id: targetUser.id } });
    await tx.medicalDocument.updateMany({ where: { user_id: placeholderUser.id }, data: { user_id: targetUser.id } });
    await tx.analyticsEvent.updateMany({ where: { user_id: placeholderUser.id }, data: { user_id: targetUser.id } });
    await tx.transaction.updateMany({ where: { user_id: placeholderUser.id }, data: { user_id: targetUser.id } });
    await tx.assistantMessage.updateMany({ where: { user_id: placeholderUser.id }, data: { user_id: targetUser.id } });
    await tx.topicMention.updateMany({ where: { user_id: placeholderUser.id }, data: { user_id: targetUser.id } });
    await tx.dailyActionLog.updateMany({ where: { userId: placeholderUser.id }, data: { userId: targetUser.id } });
    await tx.adviceLog.updateMany({ where: { userId: placeholderUser.id }, data: { userId: targetUser.id } });
    await tx.disclosureLog.updateMany({ where: { userId: placeholderUser.id }, data: { userId: targetUser.id } });
    await tx.consultantLog.updateMany({ where: { userId: placeholderUser.id }, data: { userId: targetUser.id } });

    // 2. test_results (user_id is uuid in Postgres)
    try {
        await tx.$executeRawUnsafe(`UPDATE test_results SET user_id = '${targetUser.id}'::uuid WHERE user_id = '${placeholderUser.id}'::uuid`);
    } catch (e) {
        console.warn("[MERGE_TX] test_results update warning:", e);
    }

    // 3. Unique 1-to-1 tables (HealthData, AssistantState, NutrientCalc)
    const targetHealth = await tx.healthData.findUnique({ where: { user_id: targetUser.id } });
    if (!targetHealth) {
        await tx.healthData.updateMany({ where: { user_id: placeholderUser.id }, data: { user_id: targetUser.id } });
    } else {
        await tx.healthData.deleteMany({ where: { user_id: placeholderUser.id } });
    }

    const targetAssistantState = await tx.assistantState.findUnique({ where: { userId: targetUser.id } });
    if (!targetAssistantState) {
        await tx.assistantState.updateMany({ where: { userId: placeholderUser.id }, data: { userId: targetUser.id } });
    } else {
        await tx.assistantState.deleteMany({ where: { userId: placeholderUser.id } });
    }

    const targetNutrientCalc = await tx.nutrientCalc.findUnique({ where: { userId: targetUser.id } });
    if (!targetNutrientCalc) {
        await tx.nutrientCalc.updateMany({ where: { userId: placeholderUser.id }, data: { userId: targetUser.id } });
    } else {
        await tx.nutrientCalc.deleteMany({ where: { userId: placeholderUser.id } });
    }

    // 4. Tables with compound unique constraints (DomainBaseline, EngagementState)
    const placeholderBaselines = await tx.domainBaseline.findMany({ where: { userId: placeholderUser.id } });
    for (const b of placeholderBaselines) {
        const existingB = await tx.domainBaseline.findUnique({
            where: { userId_domain: { userId: targetUser.id, domain: b.domain } }
        });
        if (!existingB) {
            await tx.domainBaseline.update({ where: { id: b.id }, data: { userId: targetUser.id } });
        } else {
            await tx.domainBaseline.delete({ where: { id: b.id } });
        }
    }

    const placeholderEngagements = await tx.engagementState.findMany({ where: { userId: placeholderUser.id } });
    for (const eng of placeholderEngagements) {
        const existingEng = await tx.engagementState.findUnique({
            where: { userId_domain: { userId: targetUser.id, domain: eng.domain } }
        });
        if (!existingEng) {
            await tx.engagementState.update({ where: { id: eng.id }, data: { userId: targetUser.id } });
        } else {
            await tx.engagementState.delete({ where: { id: eng.id } });
        }
    }

    // 5. Squads & Consultations & Permissions
    await tx.squad.updateMany({ where: { creator_id: placeholderUser.id }, data: { creator_id: targetUser.id } });
    const placeholderSquads = await tx.squadParticipant.findMany({ where: { user_id: placeholderUser.id } });
    for (const sp of placeholderSquads) {
        const existingSp = await tx.squadParticipant.findUnique({
            where: { squad_id_user_id: { squad_id: sp.squad_id, user_id: targetUser.id } }
        });
        if (!existingSp) {
            await tx.squadParticipant.update({ where: { id: sp.id }, data: { user_id: targetUser.id } });
        } else {
            await tx.squadParticipant.delete({ where: { id: sp.id } });
        }
    }

    await tx.consultation.updateMany({ where: { client_id: placeholderUser.id }, data: { client_id: targetUser.id } });
    await tx.consultation.updateMany({ where: { specialist_id: placeholderUser.id }, data: { specialist_id: targetUser.id } });

    const placeholderPerms = await tx.accessPermission.findMany({ where: { user_id: placeholderUser.id } });
    for (const perm of placeholderPerms) {
        const existingPerm = await tx.accessPermission.findUnique({
            where: { user_id_test_id: { user_id: targetUser.id, test_id: perm.test_id } }
        });
        if (!existingPerm) {
            await tx.accessPermission.update({ where: { id: perm.id }, data: { user_id: targetUser.id } });
        } else {
            await tx.accessPermission.delete({ where: { id: perm.id } });
        }
    }

    // 6. Referrals: update users whose referrer was placeholder
    await tx.user.updateMany({ where: { referrer_id: placeholderUser.id }, data: { referrer_id: targetUser.id } });

    // 7. Calculate merged subscription expiry (take the later of the two dates)
    const tExp = targetUser.subscription_expires_at ? new Date(targetUser.subscription_expires_at).getTime() : 0;
    const pExp = placeholderUser.subscription_expires_at ? new Date(placeholderUser.subscription_expires_at).getTime() : 0;
    const maxExpiryTime = Math.max(tExp, pExp);
    const finalSubscriptionExpiry = maxExpiryTime > 0 ? new Date(maxExpiryTime) : null;

    // Preserve earlier created_at to avoid trial reset
    const tCreated = new Date(targetUser.created_at).getTime();
    const pCreated = new Date(placeholderUser.created_at).getTime();
    const earlierCreatedAt = new Date(Math.min(tCreated, pCreated));

    // 8. Update target user
    const updatedTargetUser = await tx.user.update({
        where: { id: targetUser.id },
        data: {
            telegram_id: placeholderUser.telegram_id || targetUser.telegram_id,
            telegram_username: placeholderUser.telegram_username || targetUser.telegram_username || null,
            timezone: targetUser.timezone && targetUser.timezone !== 'Europe/Moscow' ? targetUser.timezone : (placeholderUser.timezone || targetUser.timezone),
            subscription_expires_at: finalSubscriptionExpiry,
            created_at: earlierCreatedAt,
            start_param: targetUser.start_param || placeholderUser.start_param,
            utm_source: targetUser.utm_source || placeholderUser.utm_source,
            utm_campaign: targetUser.utm_campaign || placeholderUser.utm_campaign,
            referrer_id: targetUser.referrer_id || placeholderUser.referrer_id
        }
    });

    // 9. Delete placeholder user
    await tx.user.delete({ where: { id: placeholderUser.id } });
    console.log(`[MERGE_TX] Successfully merged ${placeholderUser.id} into ${targetUser.id} and deleted placeholder`);

    return updatedTargetUser;
}
