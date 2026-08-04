import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
    try {
        const secretKey = process.env.LAVA_WEBHOOK_SECRET;
        if (!secretKey) {
            console.error('[LAVA WEBHOOK] Missing webhook secret key in env');
            return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
        }

        const authHeader = req.headers.get('authorization') || req.headers.get('x-api-key') || '';
        
        // Lava might send 'Bearer <key>' or just '<key>'
        if (!authHeader.includes(secretKey)) {
             console.error('[LAVA WEBHOOK] Unauthorized request. Invalid API Key provided by Lava.');
             return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        let body: any;
        const contentType = req.headers.get('content-type') || '';

        if (contentType.includes('application/json')) {
            body = await req.json();
        } else {
            const text = await req.text();
            body = Object.fromEntries(new URLSearchParams(text));
        }

        console.log('[LAVA WEBHOOK] Received payload:', body);

        // Typical webhook structure for Lava: { orderId: '...', status: 'success', amount: 300 }
        // Depending on API version it might be inside an 'event' object.
        const orderId = body.orderId || body.order_id || body.id;
        const paymentStatus = body.status || body.payment_status;

        // Ensure we consider both 'success' and 'COMPLETED' (as mentioned in wc-lava-gateway)
        if (paymentStatus !== 'success' && paymentStatus !== 'COMPLETED' && paymentStatus !== 'completed') {
            console.log(`[LAVA WEBHOOK] Payment not successful, status: ${paymentStatus}`);
            return NextResponse.json({ status: 'ok' });
        }

        if (!orderId) {
            console.error('[LAVA WEBHOOK] Missing orderId in body');
            return NextResponse.json({ status: 'ok' });
        }

        // Look up the pending transaction to identify the user and plan
        const pendingTx = await prisma.transaction.findUnique({
            where: { id: orderId }
        });

        if (!pendingTx) {
            console.error(`[LAVA WEBHOOK] Transaction not found for orderId: ${orderId}`);
            return NextResponse.json({ status: 'ok' });
        }

        if (pendingTx.type === 'SUBSCRIPTION') {
            console.log(`[LAVA WEBHOOK] Payment ${orderId} already processed (idempotency check).`);
            return NextResponse.json({ status: 'ok' });
        }

        if (pendingTx.type !== 'PENDING_LAVA') {
            console.error(`[LAVA WEBHOOK] Transaction ${orderId} has invalid type: ${pendingTx.type}`);
            return NextResponse.json({ status: 'ok' });
        }

        const userId = pendingTx.user_id;
        
        let plan: string | null = null;
        const descriptionStr = pendingTx.description || '';
        const descParts = descriptionStr.split('|');
        for (const part of descParts) {
            if (part.startsWith('plan:')) {
                plan = part.split(':')[1];
            }
        }

        if (!userId || !plan) {
            console.error('[LAVA WEBHOOK] Missing user_id or plan in pending transaction:', descriptionStr);
            return NextResponse.json({ status: 'ok' });
        }

        const amount = pendingTx.amount ? Number(pendingTx.amount) : parseFloat(body.sum || body.amount || '0');

        // Find user
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { referrer: true }
        });

        if (!user) {
            console.error('[LAVA WEBHOOK] User not found:', userId);
            return NextResponse.json({ status: 'ok' });
        }

        // Extend subscription by 30 days
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

        // Send Telegram notification (in English for Lava users)
        if (user.telegram_id) {
            const botToken = process.env.VIREYOU_BOT_TOKEN || '8648031032:AAHEJ-6KQqIS_I5_VenJXR4uPCYnPk63jiM';
            const formattedDate = newExpiry.toLocaleDateString('en-US', { day: '2-digit', month: 'long', year: 'numeric' });
            const planName = plan === 'PRO' ? 'VIReyou PRO' : 'VIReyou Standard';
            const messageText = `🎉 Congratulations! Your ${planName} subscription has been activated!\n\n📅 Valid until: ${formattedDate}\n\nThank you for choosing VIReyou 🌿`;
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
                console.error('[LAVA WEBHOOK] Failed to send telegram notification:', e);
            }
        }

        // Log transaction by updating the pending one
        await prisma.transaction.update({
            where: { id: pendingTx.id },
            data: {
                amount: -amount,
                type: 'SUBSCRIPTION',
                description: `Lava payment: ${plan} plan (ID: ${orderId})`
            }
        });

        // Referral bonuses — Level 1 (10%)
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
                    description: `Referral bonus 10% for inviting ${user.full_name || user.email} (Payment: ${orderId})`
                }
            });

            // Notify L1 referrer via Telegram
            if (updatedReferrer.telegram_id) {
                const botToken = process.env.VIREYOU_BOT_TOKEN || '8648031032:AAHEJ-6KQqIS_I5_VenJXR4uPCYnPk63jiM';
                const friendName = user.full_name || 'Your friend';
                const newBalance = Number(updatedReferrer.balance).toFixed(0);
                const bonusText = l1Bonus.toFixed(0);
                const notifyText = `🎁 Referral bonus!\n\n👤 ${friendName} paid for a subscription.\n💰 You earned: +${bonusText} ₽\n💼 Your balance: ${newBalance} ₽\n\nCheck details in the Wallet section → Transaction History.`;
                try {
                    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ chat_id: updatedReferrer.telegram_id, text: notifyText })
                    });
                } catch (e) {
                    console.error('[LAVA WEBHOOK] Failed to send L1 referral notification:', e);
                }
            }

            // Level 2 (5%) — only for employee role
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
                            description: `Referral bonus 5% (friend's friend: ${user.full_name || user.email})`
                        }
                    });

                    if (updatedL2.telegram_id) {
                        const botToken = process.env.VIREYOU_BOT_TOKEN || '8648031032:AAHEJ-6KQqIS_I5_VenJXR4uPCYnPk63jiM';
                        const newBalanceL2 = Number(updatedL2.balance).toFixed(0);
                        const bonusTextL2 = l2Bonus.toFixed(0);
                        const notifyTextL2 = `🎁 Referral bonus!\n\n👥 Your friend's friend (${user.full_name || 'user'}) paid for a subscription.\n💰 You earned: +${bonusTextL2} ₽\n💼 Your balance: ${newBalanceL2} ₽`;
                        try {
                            await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ chat_id: updatedL2.telegram_id, text: notifyTextL2 })
                            });
                        } catch (e) {
                            console.error('[LAVA WEBHOOK] Failed to send L2 referral notification:', e);
                        }
                    }
                }
            }
        }

        console.log(`[LAVA WEBHOOK] Successfully processed payment ${orderId} for user ${user.email}`);
        return NextResponse.json({ status: 'ok' });

    } catch (error) {
        console.error('[LAVA WEBHOOK] Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
