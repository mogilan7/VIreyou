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

        console.log(`[LAVA] Attempting to create invoice. OfferID: ${offerId}, API Key (first 5 chars): ${apiKey.substring(0,5)}...`);

        // 2. Call Lava.top API to generate the invoice/checkout link
        
        // Lava.top forbids creators from buying their own products. If the user's email 
        // matches the creator's, it returns "Incorrect email to purchase". 
        // For users without an email, we generate a unique one so Lava accepts it.
        const buyerEmail = user.email ? user.email : `buyer_${user.id.substring(0,8)}@vireyou.com`;

        const response = await fetch('https://gate.lava.top/api/v3/invoice', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'X-Api-Key': apiKey 
            },
            body: JSON.stringify({
                email: buyerEmail, 
                offerId: offerId,
                currency: 'USD', // API v3 might require currency, we will use USD since it's for foreigners
                // successUrl and failUrl are configured inside the product in Lava.top for v3 API
                customData: JSON.stringify({ userId: user.id, plan: plan, orderId: orderId })
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error(`[LAVA] API Error from Lava.top. Status: ${response.status}. Body: ${errText}`);
            console.error(`[LAVA] Request payload was: offerId=${offerId}, amount=${amount}`);
            return NextResponse.json({ error: `Lava API Error: ${response.status}` }, { status: 500 });
        }

        const data = await response.json();
        console.log('[LAVA] Invoice created successfully:', JSON.stringify(data));
        
        let paymentUrl = data.url || data.paymentUrl || data.data?.url;

        if (!paymentUrl) {
             console.error('[LAVA] No payment URL returned in data:', JSON.stringify(data));
             return NextResponse.json({ error: 'Failed to generate payment link' }, { status: 500 });
        }

        // Try to force English language via query parameters
        try {
             const urlObj = new URL(paymentUrl);
             urlObj.searchParams.set('lang', 'en');
             urlObj.searchParams.set('locale', 'en');
             paymentUrl = urlObj.toString();
        } catch (e) {
             // Ignore if URL parsing fails
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
