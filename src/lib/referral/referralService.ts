import prisma from '../prisma';

export async function processReferralReward(userId: string, amount: number) {
  // 1. Get user and their referrer
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      referrer: {
        include: {
          referrer: true // For Level 2
        }
      }
    }
  });

  if (!user || !user.referrer_id) return;

  const level1Referrer = user.referrer;
  if (!level1Referrer) return;

  // Level 1 Reward (10%)
  const level1Reward = amount * 0.10;
  await grantBalance(level1Referrer.id, level1Reward, 'EARNED_REF_L1', `Referral bonus (L1) from ${user.telegram_id || user.id}`);

  // Level 2 Reward (5%)
  // Only grant Level 2 if Level 1 referrer is a PRO or Employee
  if (['pro', 'employee', 'admin'].includes(level1Referrer.role.toLowerCase()) && level1Referrer.referrer_id) {
    const level2Referrer = level1Referrer.referrer;
    if (level2Referrer) {
      const level2Reward = amount * 0.05;
      await grantBalance(level2Referrer.id, level2Reward, 'EARNED_REF_L2', `Referral bonus (L2) from ${user.telegram_id || user.id}`);
    }
  }
}

async function grantBalance(userId: string, amount: number, type: string, description: string) {
  await prisma.$transaction(async (tx: any) => {
    await tx.user.update({
      where: { id: userId },
      data: { balance: { increment: amount } }
    });

    await tx.transaction.create({
      data: {
        user_id: userId,
        amount: amount,
        type: type,
        description: description
      }
    });
  });
}

export async function linkReferral(newUserId: string, referrerId: string) {
  // First Click Attribution: Only link if they don't have one already
  const user = await prisma.user.findUnique({ where: { id: newUserId } });
  if (user && !user.referrer_id) {
    await prisma.user.update({
      where: { id: newUserId },
      data: { referrer_id: referrerId }
    });
    return true;
  }
  return false;
}
