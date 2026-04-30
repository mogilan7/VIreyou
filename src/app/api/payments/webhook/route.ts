import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        
        // В продакшене здесь должна быть проверка IP ЮKassa или подписи
        // Для простоты пока доверяем метаданным
        
        if (body.event === 'payment.succeeded') {
            const payment = body.object;
            const userId = payment.metadata.user_id;
            const plan = payment.metadata.plan;
            const amount = parseFloat(payment.amount.value);

            // 1. Обновляем подписку пользователя
            const user = await prisma.user.findUnique({
                where: { id: userId },
                include: { referrer: true }
            });

            if (!user) {
                console.error('Webhook Error: User not found', userId);
                return NextResponse.json({ status: 'ok' }); // Все равно 200, чтобы ЮKassa не слала повторно
            }

            // Продлеваем на 30 дней от текущей даты или даты окончания (если она в будущем)
            const currentExpiry = user.subscription_expires_at && user.subscription_expires_at > new Date() 
                ? user.subscription_expires_at 
                : new Date();
            
            const newExpiry = new Date(currentExpiry.getTime() + 30 * 24 * 60 * 60 * 1000);

            await prisma.user.update({
                where: { id: user.id },
                data: { 
                    subscription_expires_at: newExpiry,
                    role: 'client' // Ensure role is client
                }
            });

            // 2. Логируем транзакцию покупки
            await prisma.transaction.create({
                data: {
                    user_id: user.id,
                    amount: -amount,
                    type: 'SUBSCRIPTION',
                    description: `Оплата подписки ${plan}`
                }
            });

            // 3. Реферальные бонусы
            // Уровень 1 (10%)
            if (user.referrer_id) {
                const l1Bonus = amount * 0.10;
                await prisma.user.update({
                    where: { id: user.referrer_id },
                    data: { balance: { increment: l1Bonus } }
                });
                await prisma.transaction.create({
                    data: {
                        user_id: user.referrer_id,
                        amount: l1Bonus,
                        type: 'REFERRAL_BONUS',
                        description: `Бонус 10% за приглашение ${user.full_name || user.email}`
                    }
                });

                // Уровень 2 (5%) - только если у L1 есть подписка PRO
                const l1 = await prisma.user.findUnique({ where: { id: user.referrer_id } });
                const l1IsPro = l1?.subscription_expires_at && l1.subscription_expires_at > new Date(); // Упрощенно считаем что любая активная подписка = PRO для бонусов

                if (l1?.referrer_id && l1IsPro) {
                    const l2Bonus = amount * 0.05;
                    await prisma.user.update({
                        where: { id: l1.referrer_id },
                        data: { balance: { increment: l2Bonus } }
                    });
                    await prisma.transaction.create({
                        data: {
                            user_id: l1.referrer_id,
                            amount: l2Bonus,
                            type: 'REFERRAL_BONUS',
                            description: `Бонус 5% за друга вашего друга (${user.full_name || user.email})`
                        }
                    });
                }
            }
        }

        return NextResponse.json({ status: 'ok' });
    } catch (error) {
        console.error('Webhook Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
