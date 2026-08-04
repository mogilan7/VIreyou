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

        const apiKey = process.env.LAVA_API_KEY;
        
        let offerId;
        if (plan === 'PRO') {
            offerId = process.env.LAVA_PRO_OFFER_ID;
        } else if (plan === 'Standard') {
            offerId = process.env.LAVA_STANDARD_OFFER_ID;
        } else {
            // Fallback to PRO or generic if not explicitly standard
            offerId = process.env.LAVA_PRO_OFFER_ID;
        }

        if (!apiKey || !offerId) {
            console.error('Lava.top credentials missing (API key or Offer ID)');
            return NextResponse.json({ error: 'Payment service unavailable' }, { status: 500 });
        }

        const orderId = crypto.randomUUID();
        
        // 1. Create a pending transaction in our DB
        await prisma.transaction.create({
            data: {
                id: orderId,
                user_id: user.id,
                amount: amount, 
                type: 'PENDING_LAVA',
                description: `Pending Lava payment: user_id:${user.id}|plan:${plan}`
            }
        });

        console.log(`[LAVA] Created pending transaction ${orderId} for user ${user.email}, plan: ${plan}`);

        // 2. Call Lava.top API to generate the invoice/checkout link
        const response = await fetch('https://api.lava.top/v1/invoices', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': apiKey // Usually just the API key without Bearer if it works, or Bearer. 400 means auth passed.
            },
            body: JSON.stringify({
                email: user.email || 'customer@vireyou.com', // Lava requires email
                offerId: offerId,
                orderId: orderId, // Some APIs allow custom orderId, we'll keep it just in case
                customData: JSON.stringify({ userId: user.id, plan: plan }),
                successUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard?payment=success`,
                failUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard?payment=fail`
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error('[LAVA] API Error from Lava.top:', response.status, errText);
            return NextResponse.json({ error: `Lava API Error: ${response.status}` }, { status: 500 });
        }

        const data = await response.json();
        console.log('[LAVA] Invoice created:', data);
        
        const paymentUrl = data.url || data.paymentUrl || data.data?.url;

        if (!paymentUrl) {
             console.error('[LAVA] No payment URL returned:', data);
             return NextResponse.json({ error: 'Failed to generate payment link' }, { status: 500 });
        }

        return NextResponse.json({ 
            orderId, 
            confirmation_url: paymentUrl
        });

    } catch (error) {
        console.error('[LAVA] Payment Create Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
