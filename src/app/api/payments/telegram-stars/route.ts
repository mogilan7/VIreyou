import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import prisma from '@/lib/prisma';
import { Telegraf } from 'telegraf';

export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user: authUser } } = await supabase.auth.getUser();

        if (!authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json().catch(() => ({}));
        const plan = body.plan === 'Standard' ? 'Standard' : 'PRO';

        const user = await prisma.user.findFirst({
            where: {
                OR: [
                    { id: authUser.id },
                    { email: authUser.email || undefined }
                ]
            }
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const botToken = process.env.TELEGRAM_BOT_TOKEN || process.env.VIREYOU_BOT_TOKEN;
        if (!botToken) {
            return NextResponse.json({ error: 'Telegram Bot Token not configured' }, { status: 500 });
        }

        const bot = new Telegraf(botToken);
        const isPro = plan === 'PRO';
        const amount = isPro ? 450 : 250;
        const planName = isPro ? 'PRO 💎' : 'Standard 🔥';

        const invoiceLink = await bot.telegram.createInvoiceLink({
            title: `Подписка VIReYou ${planName} (30 дней)`,
            description: isPro
                ? 'Полный доступ: ИИ-советник по питанию, анализ долголетия, марафоны и смарт-калькуляторы.'
                : 'Базовый доступ: распознавание еды по фото, подсчет КБЖУ, витаминов и анализ состава.',
            payload: `stars_${isPro ? 'pro' : 'standard'}_${user.id}_${Date.now()}`,
            provider_token: '',
            currency: 'XTR',
            prices: [{ label: `${planName} (30 дн)`, amount }]
        });

        return NextResponse.json({ 
            invoiceLink, 
            amount,
            currency: 'XTR',
            plan
        });
    } catch (error: any) {
        console.error('[TELEGRAM STARS API] Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to generate Stars invoice' }, { status: 500 });
    }
}
