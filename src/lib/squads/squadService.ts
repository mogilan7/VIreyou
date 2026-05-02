import prisma from '../prisma';

/**
 * Creates a new 7-day mini-marathon (Squad).
 */
export async function createSquad(creatorId: string, name: string) {
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(startDate.getDate() + 7);

    return await prisma.squad.create({
        data: {
            creator_id: creatorId,
            name: name,
            start_date: startDate,
            end_date: endDate,
            participants: {
                create: {
                    user_id: creatorId,
                    score: 0
                }
            }
        }
    });
}

/**
 * Adds a user to a Squad if they are not already in it.
 */
export async function joinSquad(squadId: string, userId: string) {
    const squad = await prisma.squad.findUnique({ where: { id: squadId } });
    if (!squad || !squad.is_active) throw new Error("Squad not found or inactive.");

    const existing = await prisma.squadParticipant.findUnique({
        where: { squad_id_user_id: { squad_id: squadId, user_id: userId } }
    });

    if (!existing) {
        await prisma.squadParticipant.create({
            data: {
                squad_id: squadId,
                user_id: userId,
                score: 0
            }
        });
        return true;
    }
    return false;
}

/**
 * Generates the current leaderboard for a Squad.
 */
export async function getSquadLeaderboard(squadId: string) {
    const participants = await prisma.squadParticipant.findMany({
        where: { squad_id: squadId },
        include: { user: true },
        orderBy: { score: 'desc' }
    });

    let leaderboardStr = "🏆 <b>Таблица лидеров челленджа:</b>\n\n";
    participants.forEach((p: any, index: number) => {
        const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : "👤";
        const name = (p.user.full_name || p.user.email || "Участник").replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const tgUser = p.user.telegram_username ? ` (@${p.user.telegram_username.replace(/</g, '&lt;').replace(/>/g, '&gt;')})` : "";
        leaderboardStr += `${medal} ${name}${tgUser} — ${p.score} баллов\n`;
    });

    return leaderboardStr;
}

/**
 * (For cron job) Calculates points for a user for the day based on their logs.
 * Includes detailed breakdown for personal reports.
 */
export async function calculateDailyScore(userId: string, dateStart: Date, dateEnd: Date) {
    let dailyScore = 0;
    const details = {
        water: 0,
        sleep: 0,
        steps: 0,
        nutrition: 0,
        waterMet: false,
        sleepMet: false,
        stepsMet: false,
        nutritionMet: false
    };

    // 1. Check Hydration (Goal: 2L)
    const hydration = await prisma.hydrationLog.aggregate({
        where: { user_id: userId, created_at: { gte: dateStart, lte: dateEnd } },
        _sum: { volume_ml: true }
    });
    details.water = hydration._sum.volume_ml || 0;
    if (details.water >= 2000) {
        dailyScore += 10;
        details.waterMet = true;
    }

    // 2. Check Sleep (Goal: 7-8h)
    const sleep = await prisma.sleepLog.findFirst({
        where: { user_id: userId, created_at: { gte: dateStart, lte: dateEnd } }
    });
    details.sleep = sleep?.duration_hrs || 0;
    if (details.sleep >= 7 && details.sleep <= 8) {
        dailyScore += 20;
        details.sleepMet = true;
    }

    // 3. Nutrition (Goal: 3 logs)
    const nutritionCount = await prisma.nutritionLog.count({
        where: { user_id: userId, created_at: { gte: dateStart, lte: dateEnd } }
    });
    details.nutrition = nutritionCount;
    if (nutritionCount >= 3) {
        dailyScore += 30;
        details.nutritionMet = true;
    }

    // 4. Activity (Goal: 10k steps)
    const activity = await prisma.activityLog.aggregate({
        where: { user_id: userId, created_at: { gte: dateStart, lte: dateEnd } },
        _sum: { steps: true }
    });
    details.steps = activity._sum.steps || 0;
    if (details.steps >= 10000) {
        dailyScore += 10;
        details.stepsMet = true;
    }

    return { score: dailyScore, details };
}

/**
 * Removes a participant from a Squad. Only the creator can do this.
 */
export async function removeParticipant(squadId: string, userIdToRemove: string, requesterId: string) {
    const squad = await prisma.squad.findUnique({ where: { id: squadId } });
    if (!squad) throw new Error("Squad not found.");
    if (squad.creator_id !== requesterId) throw new Error("Only the creator can remove participants.");
    if (userIdToRemove === squad.creator_id) throw new Error("The creator cannot be removed from their own squad.");

    await prisma.squadParticipant.delete({
        where: { squad_id_user_id: { squad_id: squadId, user_id: userIdToRemove } }
    });
    return true;
}

/**
 * Gets all participants of a squad with their names.
 */
export async function getSquadParticipants(squadId: string) {
    return await prisma.squadParticipant.findMany({
        where: { squad_id: squadId },
        include: { user: true }
    });
}

