import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { Telegraf } from 'telegraf';
import crypto from 'crypto';

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN as string);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, metrics, steps: rawSteps, hrv: rawHrv, resting_hr: rawRestingHr } = body;

    if (!token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 400 });
    }

    // Find the user with this token
    const user = await prisma.user.findUnique({
      where: { health_export_token: token },
      include: { HealthData: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    let sleepDurationHrs = 0;
    let sleepStart: Date | null = null;
    let sleepEnd: Date | null = null;
    let avgHrv: number | null = null;
    let avgRestingHr: number | null = null;
    let steps = 0;

    // 1. Process structured metrics array (if provided)
    if (metrics && Array.isArray(metrics)) {
      for (const m of metrics) {
        if (m.type === 'SleepAnalysis' && (m.value === 'Asleep' || m.value === 'InBed')) {
          const start = new Date(m.startDate);
          const end = new Date(m.endDate);
          const duration = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
          sleepDurationHrs += duration;
          if (!sleepStart || start < sleepStart) sleepStart = start;
          if (!sleepEnd || end > sleepEnd) sleepEnd = end;
        }
      }

      let hrvValues: number[] = [];
      let hrValues: number[] = [];

      for (const m of metrics) {
        const metricDate = new Date(m.date || m.startDate);
        const isDuringSleep = sleepStart && sleepEnd ? (metricDate >= sleepStart && metricDate <= sleepEnd) : true;

        if (m.type === 'HRV' && isDuringSleep) {
          hrvValues.push(Number(m.value));
        } else if (m.type === 'RestingHeartRate' && isDuringSleep) {
          hrValues.push(Number(m.value));
        } else if (m.type === 'StepCount') {
          steps += Number(m.value);
        }
      }

      if (hrvValues.length > 0) avgHrv = Math.round(hrvValues.reduce((a, b) => a + b, 0) / hrvValues.length);
      if (hrValues.length > 0) avgRestingHr = Math.round(hrValues.reduce((a, b) => a + b, 0) / hrValues.length);
    } 
    // 2. Process flat dictionary (from simple Shortcuts)
    else {
      const parseSamples = (val: any): number[] => {
        if (!val) return [];
        if (Array.isArray(val)) return val.map(Number).filter(n => !isNaN(n));
        if (typeof val === 'string') return val.replace(/[^\d.,]/g, ' ').split(/\s+/).map(s => parseFloat(s.replace(',', '.'))).filter(n => !isNaN(n));
        if (typeof val === 'number') return [val];
        return [];
      };

      const hrvArr = parseSamples(rawHrv);
      if (hrvArr.length > 0) avgHrv = Math.round(hrvArr.reduce((a, b) => a + b, 0) / hrvArr.length);

      const hrArr = parseSamples(rawRestingHr);
      if (hrArr.length > 0) avgRestingHr = Math.round(hrArr.reduce((a, b) => a + b, 0) / hrArr.length);

      const stepsArr = parseSamples(rawSteps);
      if (stepsArr.length > 0) steps = Math.round(stepsArr.reduce((a, b) => a + b, 0));
    }

    // Save to Database
    
    // 1. Update HealthData
    if (avgHrv || avgRestingHr || sleepDurationHrs > 0) {
      const healthDataPayload: any = {};
      if (avgHrv) healthDataPayload.hrv_value = avgHrv;
      if (avgRestingHr) healthDataPayload.baseline_resting_hr = avgRestingHr;
      if (sleepDurationHrs > 0) healthDataPayload.sleep_duration_hrs = Number(sleepDurationHrs.toFixed(2));

      if (user.HealthData) {
        await prisma.healthData.update({
          where: { user_id: user.id },
          data: healthDataPayload,
        });
      } else {
        await prisma.healthData.create({
          data: {
            user_id: user.id,
            ...healthDataPayload,
          },
        });
      }
    }

    // 2. Create SleepLog if sleep data exists
    if (sleepDurationHrs > 0) {
      await prisma.sleepLog.create({
        data: {
          id: crypto.randomUUID(),
          user_id: user.id,
          date: new Date(),
          duration_hrs: sleepDurationHrs,
          hrv: avgHrv,
          resting_heart_rate: avgRestingHr,
        },
      });
    }

    // 3. Create ActivityLog if steps exist
    if (steps > 0) {
      await prisma.activityLog.create({
        data: {
          id: crypto.randomUUID(),
          user_id: user.id,
          date: new Date(),
          steps: steps,
        },
      });
    }

    // Notify user in Telegram
    if (user.telegram_id) {
      let message = `✅ Метрики здоровья успешно синхронизированы!\n\n`;
      if (avgHrv) message += `💓 ВСР (во время сна): ${avgHrv} мс\n`;
      if (avgRestingHr) message += `🫀 Пульс покоя (сон): ${avgRestingHr} уд/мин\n`;
      if (sleepDurationHrs > 0) message += `😴 Сон: ${sleepDurationHrs.toFixed(1)} ч.\n`;
      if (steps > 0) message += `👣 Шаги: ${steps}\n`;

      try {
        await bot.telegram.sendMessage(user.telegram_id, message);
      } catch (err) {
        console.error('Failed to notify telegram user:', err);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in health export:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
