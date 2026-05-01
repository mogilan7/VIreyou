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
 * Example simplified point system:
 * +10 points for perfect water intake
 * +20 points for sleep > 7 hours
 * +30 points for good nutrition logs
 */
export async function calculateDailyScore(userId: string, dateStart: Date, dateEnd: Date) {
    let dailyScore = 0;

    // 1. Check Hydration
    const hydration = await prisma.hydrationLog.aggregate({
        where: { user_id: userId, created_at: { gte: dateStart, lte: dateEnd } },
        _sum: { volume_ml: true }
    });
    if ((hydration._sum.volume_ml || 0) >= 2000) dailyScore += 10;

    // 2. Check Sleep
    const sleep = await prisma.sleepLog.findFirst({
        where: { user_id: userId, created_at: { gte: dateStart, lte: dateEnd } }
    });
    if (sleep && (sleep.duration_hrs || 0) >= 7) dailyScore += 20;

    // 3. Nutrition (Just logging gives points)
    const nutritionCount = await prisma.nutritionLog.count({
        where: { user_id: userId, created_at: { gte: dateStart, lte: dateEnd } }
    });
    if (nutritionCount >= 3) dailyScore += 30;

    // 4. Activity (Steps)
    const activity = await prisma.activityLog.aggregate({
        where: { user_id: userId, created_at: { gte: dateStart, lte: dateEnd } },
        _sum: { steps: true }
    });
    if ((activity._sum.steps || 0) >= 8000) dailyScore += 10;

    return dailyScore;
}
