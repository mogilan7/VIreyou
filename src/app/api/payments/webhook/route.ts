import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        
        // В продакшене здесь должна быть проверка IP ЮKassa или подписи
        // Для простоты пока доверяем метаданным
        
        if (body.event === 'payment.succeeded') {
            const payment = body.object;
            const paymentId = payment.id;
            const userId = payment.metadata.user_id;
            const plan = payment.metadata.plan;
            const amount = parseFloat(payment.amount.value);

            // 0. Check for idempotency: has this payment already been processed?
            const existingTx = await prisma.transaction.findFirst({
                where: {
                    user_id: userId,
                    description: { contains: paymentId }
                }
            });

            if (existingTx) {
                console.log(`[PAYMENT] Payment ${paymentId} already processed. Skipping.`);
                return NextResponse.json({ status: 'ok' });
            }

            // 1. Обновляем подписку пользователя
            const user = await prisma.user.findUnique({
                where: { id: userId },
                include: { referrer: true }
            });

            if (!user) {
                console.error('Webhook Error: User not found', userId);
                return NextResponse.json({ status: 'ok' });
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
                    role: (user.role === 'employee' || user.role === 'admin') ? user.role : (plan === 'PRO' ? 'PRO' : 'client')
                }
            });

            // Отправляем уведомление в Telegram (если привязан)
            if (user.telegram_id) {
                const botToken = process.env.VIREYOU_BOT_TOKEN || '8648031032:AAHEJ-6KQqIS_I5_VenJXR4uPCYnPk63jiM';
                const formattedDate = newExpiry.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
                const messageText = `🎉 Поздравляем, ваша подписка ${plan === 'PRO' ? 'PRO' : 'Standard'} успешно активирована!\n\n📅 Действует до: ${formattedDate}`;
                try {
                    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            chat_id: user.telegram_id,
                            text: messageText
                        })
                    });
                } catch (e) {
                    console.error('Failed to send telegram notification:', e);
                }
            }

            // 2. Логируем транзакцию покупки (включаем paymentId для идемпотентности)
            await prisma.transaction.create({
                data: {
                    user_id: user.id,
                    amount: -amount,
                    type: 'SUBSCRIPTION',
                    description: `Оплата подписки ${plan} (ID: ${paymentId})`
                }
            });

            // 3. Реферальные бонусы
            // Уровень 1 (10%)
            if (user.referrer_id) {
                const l1Bonus = amount * 0.10;
                const updatedReferrer = await prisma.user.update({
                    where: { id: user.referrer_id },
                    data: { balance: { increment: l1Bonus } }
                });
                await prisma.transaction.create({
                    data: {
                        user_id: user.referrer_id,
                        amount: l1Bonus,
                        type: 'REFERRAL_BONUS',
                        description: `Бонус 10% за приглашение ${user.full_name || user.email} (Payment: ${paymentId})`
                    }
                });

                // Уведомление рефереру (L1) в Telegram
                if (updatedReferrer.telegram_id) {
                    const botToken = process.env.VIREYOU_BOT_TOKEN || '8648031032:AAHEJ-6KQqIS_I5_VenJXR4uPCYnPk63jiM';
                    const friendName = user.full_name || 'Ваш друг';
                    const newBalance = Number(updatedReferrer.balance).toFixed(0);
                    const bonusText = l1Bonus.toFixed(0);
                    const notifyText = `🎁 Реферальный бонус!\n\n👤 ${friendName} оплатил подписку.\n💰 Вам начислено: +${bonusText} ₽\n💼 Ваш баланс: ${newBalance} ₽\n\nСмотрите детали в разделе «Кошелёк» → История операций.`;
                    try {
                        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                chat_id: updatedReferrer.telegram_id,
                                text: notifyText
                            })
                        });
                    } catch (e) {
                        console.error('Failed to send referral bonus notification (L1):', e);
                    }
                }

                // Уровень 2 (5%) - только если L2 является сотрудником (role === 'employee')
                const l1 = await prisma.user.findUnique({ where: { id: user.referrer_id } });
                
                if (l1?.referrer_id) {
                    const l2 = await prisma.user.findUnique({ where: { id: l1.referrer_id } });
                    
                    if (l2 && l2.role === 'employee') {
                        const l2Bonus = amount * 0.05;
                        const updatedL2 = await prisma.user.update({
                            where: { id: l2.id },
                            data: { balance: { increment: l2Bonus } }
                        });
                        await prisma.transaction.create({
                            data: {
                                user_id: l2.id,
                                amount: l2Bonus,
                                type: 'REFERRAL_BONUS',
                                description: `Бонус 5% за друга вашего друга (${user.full_name || user.email})`
                            }
                        });

                        // Уведомление рефереру (L2) в Telegram
                        if (updatedL2.telegram_id) {
                            const botToken = process.env.VIREYOU_BOT_TOKEN || '8648031032:AAHEJ-6KQqIS_I5_VenJXR4uPCYnPk63jiM';
                            const newBalanceL2 = Number(updatedL2.balance).toFixed(0);
                            const bonusTextL2 = l2Bonus.toFixed(0);
                            const notifyTextL2 = `🎁 Реферальный бонус!\n\n👥 Друг вашего друга (${user.full_name || 'пользователь'}) оплатил подписку.\n💰 Вам начислено: +${bonusTextL2} ₽\n💼 Ваш баланс: ${newBalanceL2} ₽`;
                            try {
                                await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        chat_id: updatedL2.telegram_id,
                                        text: notifyTextL2
                                    })
                                });
                            } catch (e) {
                                console.error('Failed to send referral bonus notification (L2):', e);
                            }
                        }
                    }
                }
            }
        }

        return NextResponse.json({ status: 'ok' });
    } catch (error) {
        console.error('Webhook Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
