import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import prisma from '@/lib/prisma';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user: authUser } } = await supabase.auth.getUser();

        if (!authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { plan, amount } = await req.json();

        if (!plan || !amount) {
            return NextResponse.json({ error: 'Missing plan or amount' }, { status: 400 });
        }

        const user = await prisma.user.findUnique({
            where: { email: authUser.email || undefined }
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const shopId = process.env.YOOKASSA_SHOP_ID;
        const secretKey = process.env.YOOKASSA_SECRET_KEY;

        if (!shopId || !secretKey) {
            console.error('YooKassa credentials missing');
            return NextResponse.json({ error: 'Payment service unavailable' }, { status: 500 });
        }

        const idempotenceKey = uuidv4();
        const auth = Buffer.from(`${shopId}:${secretKey}`).toString('base64');

        const response = await fetch('https://api.yookassa.ru/v3/payments', {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Idempotence-Key': idempotenceKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                amount: {
                    value: amount.toString(),
                    currency: 'RUB'
                },
                confirmation: {
                    type: 'redirect',
                    return_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://vireyou.com'}/${req.nextUrl.locale}/cabinet/wallet`
                },
                capture: true,
                description: `Подписка VIReyou ${plan} для ${user.email}`,
                metadata: {
                    user_id: user.id,
                    plan: plan
                }
            })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('YooKassa Error:', data);
            return NextResponse.json({ error: 'Failed to create payment' }, { status: 500 });
        }

        return NextResponse.json({ confirmation_url: data.confirmation.confirmation_url });

    } catch (error) {
        console.error('Payment Create Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
