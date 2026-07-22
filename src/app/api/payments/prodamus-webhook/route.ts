import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import crypto from 'crypto';

/**
 * Prodamus HMAC verification:
 * Same algorithm as signing — compare received signature from Sign header
 * with computed signature from POST body data.
 */
function stringifyValues(obj: any): any {
    if (Array.isArray(obj)) {
        return obj.map(stringifyValues);
    } else if (obj !== null && typeof obj === 'object') {
        const result: any = {};
        for (const key of Object.keys(obj)) {
            result[key] = stringifyValues(obj[key]);
        }
        return result;
    }
    return String(obj);
}

function sortObjectKeys(obj: any): any {
    if (Array.isArray(obj)) {
        return obj.map(sortObjectKeys);
    } else if (obj !== null && typeof obj === 'object') {
        const sorted: any = {};
        for (const key of Object.keys(obj).sort()) {
            sorted[key] = sortObjectKeys(obj[key]);
        }
        return sorted;
    }
    return obj;
}

function verifyProdamusSignature(data: any, secretKey: string, receivedSign: string): boolean {
    // Remove signature field from data before verifying
    const { signature, ...dataWithoutSign } = data;
    const withStrings = stringifyValues(dataWithoutSign);
    const sorted = sortObjectKeys(withStrings);
    const jsonStr = JSON.stringify(sorted).replace(/\//g, '\\/');
    const computedSign = crypto.createHmac('sha256', secretKey).update(jsonStr).digest('hex');
    return computedSign === receivedSign;
}

export async function POST(req: NextRequest) {
    try {
        const secretKey = process.env.PRODAMUS_SECRET_KEY;
        if (!secretKey) {
            console.error('[PRODAMUS WEBHOOK] Missing secret key');
            return NextResponse.json({ error: 'Configuration error' }, { status: 500 });
        }

        // Prodamus sends POST with application/x-www-form-urlencoded or JSON
        let body: Record<string, any>;
        const contentType = req.headers.get('content-type') || '';

        if (contentType.includes('application/json')) {
            body = await req.json();
        } else {
            // Form-encoded (most common for Prodamus)
            const text = await req.text();
            body = Object.fromEntries(new URLSearchParams(text));
        }

        // Verify signature from Sign header
        const signHeader = req.headers.get('Sign');
        if (!signHeader) {
            console.error('[PRODAMUS WEBHOOK] Missing Sign header');
            return NextResponse.json({ error: 'Signature required' }, { status: 400 });
        }

        const isValid = verifyProdamusSignature(body, secretKey, signHeader);
        if (!isValid) {
            console.error('[PRODAMUS WEBHOOK] Invalid signature');
            return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
        }

        // Check payment status
        const paymentStatus = body.payment_status || body.status;
        if (paymentStatus !== 'success') {
            console.log(`[PRODAMUS WEBHOOK] Payment not successful, status: ${paymentStatus}`);
            return NextResponse.json({ status: 'ok' });
        }

        // Extract data from webhook body
        const orderId = body.order_id || body.order_num;
        const customerExtra = body.customer_extra || '';
        const paymentId = body.payment_id || orderId;

        // Parse user_id and plan from customer_extra: "user_id:xxx|plan:yyy"
        let userId: string | null = null;
        let plan: string | null = null;

        const extraParts = customerExtra.split('|');
        for (const part of extraParts) {
            const [k, v] = part.split(':');
            if (k === 'user_id') userId = v;
            if (k === 'plan') plan = v;
        }

        if (!userId || !plan) {
            console.error('[PRODAMUS WEBHOOK] Missing user_id or plan in customer_extra:', customerExtra);
            return NextResponse.json({ status: 'ok' });
        }

        // Amount paid
        const amount = parseFloat(body.sum || body.amount || '0');

        // Idempotency check
        const existingTx = await prisma.transaction.findFirst({
            where: {
                user_id: userId,
                description: { contains: paymentId }
            }
        });

        if (existingTx) {
            console.log(`[PRODAMUS WEBHOOK] Payment ${paymentId} already processed. Skipping.`);
            return NextResponse.json({ status: 'ok' });
        }

        // Find user
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { referrer: true }
        });

        if (!user) {
            console.error('[PRODAMUS WEBHOOK] User not found:', userId);
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

        // Send Telegram notification (in English for Prodamus users)
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
                console.error('[PRODAMUS WEBHOOK] Failed to send telegram notification:', e);
            }
        }

        // Log transaction
        await prisma.transaction.create({
            data: {
                user_id: user.id,
                amount: -amount,
                type: 'SUBSCRIPTION',
                description: `Prodamus payment: ${plan} plan (ID: ${paymentId})`
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
                    description: `Referral bonus 10% for inviting ${user.full_name || user.email} (Payment: ${paymentId})`
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
                    console.error('[PRODAMUS WEBHOOK] Failed to send L1 referral notification:', e);
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
                            console.error('[PRODAMUS WEBHOOK] Failed to send L2 referral notification:', e);
                        }
                    }
                }
            }
        }

        console.log(`[PRODAMUS WEBHOOK] Successfully processed payment ${paymentId} for user ${user.email}`);
        return NextResponse.json({ status: 'ok' });

    } catch (error) {
        console.error('[PRODAMUS WEBHOOK] Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
