import prisma from "../prisma";
import crypto from "crypto";

export async function calculateAllUserBaselines() {
  console.log("[CRON] Starting baseline calculation for all users...");
  const users = await prisma.user.findMany({ select: { id: true } });

  const now = new Date();
  const baselineEnd = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago (end of baseline window)
  const baselineStart = new Date(baselineEnd.getTime() - 60 * 24 * 60 * 60 * 1000); // 60 days before baseline end

  let updatedCount = 0;

  for (const user of users) {
    // 1. Fetch 60 days of sleep logs up to 7 days ago
    const logs = await prisma.sleepLog.findMany({
      where: {
        user_id: user.id,
        date: { gte: baselineStart, lt: baselineEnd }
      }
    });

    const hrvValues = logs.map(l => l.hrv).filter(v => v !== null && v > 0) as number[];
    const rhrValues = logs.map(l => l.resting_heart_rate).filter(v => v !== null && v > 0) as number[];

    // 2. Trim 5% outliers and calculate mean
    const trimmedMean = (values: number[]): number | null => {
      if (values.length === 0) return null;
      if (values.length <= 4) {
        return values.reduce((a, b) => a + b, 0) / values.length; // Not enough data to trim
      }
      values.sort((a, b) => a - b);
      const trimCount = Math.max(1, Math.floor(values.length * 0.05));
      const trimmed = values.slice(trimCount, values.length - trimCount);
      if (trimmed.length === 0) return null;
      return trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
    };

    const newHrv = trimmedMean(hrvValues);
    const newRhr = trimmedMean(rhrValues);

    // 3. Upsert into HealthData
    if (newHrv !== null || newRhr !== null) {
      await prisma.healthData.upsert({
        where: { user_id: user.id },
        update: {
          baseline_hrv: newHrv,
          baseline_resting_hr: newRhr
        },
        create: {
          id: crypto.randomUUID(),
          user_id: user.id,
          baseline_hrv: newHrv,
          baseline_resting_hr: newRhr
        }
      });
      updatedCount++;
    }
  }

  console.log(`[CRON] Baseline calculation complete. Updated ${updatedCount} users.`);
}
