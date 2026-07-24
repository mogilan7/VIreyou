import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import prisma from '@/lib/prisma';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user: authUser } } = await supabase.auth.getUser();

        if (!authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { plan, amount, locale } = await req.json();

        if (!plan || !amount) {
            return NextResponse.json({ error: 'Missing plan or amount' }, { status: 400 });
        }

        const user = await prisma.user.findUnique({
            where: { email: authUser.email || undefined }
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const merchantId = process.env.NEXT_PUBLIC_PRODAMUS_MERCHANT_ID;
        const salesChannelId = process.env.NEXT_PUBLIC_PRODAMUS_SALES_CHANNEL_ID;

        if (!merchantId || !salesChannelId) {
            console.error('Prodamus credentials missing');
            return NextResponse.json({ error: 'Payment service unavailable' }, { status: 500 });
        }

        const orderId = crypto.randomUUID();
        const planLabel = plan === 'PRO' ? 'VIReyou PRO Subscription' : 'VIReyou Standard Subscription';

        // Convert USD to RUB (e.g., $7 -> 630 RUB)
        const USD_TO_RUB_RATE = 90; 
        const rubAmount = amount * USD_TO_RUB_RATE;

        // Create a pending transaction in the database so the webhook can identify the user
        await prisma.transaction.create({
            data: {
                id: orderId, // override default cuid/uuid with our generated orderId
                user_id: user.id,
                amount: rubAmount,
                type: 'PENDING_PRODAMUS',
                description: `Pending Prodamus payment: user_id:${user.id}|plan:${plan}`
            }
        });

        console.log(`[PRODAMUS] Created pending transaction ${orderId} for user ${user.email}, plan: ${plan}, amount: ${rubAmount} RUB`);

        // Return orderId to frontend to initialize the widget
        return NextResponse.json({ 
            orderId, 
            rubAmount,
            planLabel
        });

    } catch (error) {
        console.error('[PRODAMUS] Payment Create Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
