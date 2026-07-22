import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import prisma from '@/lib/prisma';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

/**
 * Prodamus HMAC signature algorithm:
 * 1. Stringify all values in data
 * 2. Sort all keys alphabetically (recursively)
 * 3. Convert to JSON string
 * 4. Escape forward slashes in JSON string
 * 5. Sign with HMAC-SHA256 using secret key
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

function createProdamusSignature(data: any, secretKey: string): string {
    const withStrings = stringifyValues(data);
    const sorted = sortObjectKeys(withStrings);
    const jsonStr = JSON.stringify(sorted).replace(/\//g, '\\/');
    return crypto.createHmac('sha256', secretKey).update(jsonStr).digest('hex');
}

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

        const prodamusUrl = process.env.PRODAMUS_PAYMENT_URL;
        const secretKey = process.env.PRODAMUS_SECRET_KEY;

        if (!prodamusUrl || !secretKey) {
            console.error('Prodamus credentials missing');
            return NextResponse.json({ error: 'Payment service unavailable' }, { status: 500 });
        }

        const orderId = uuidv4();
        const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://vireyou.com').replace(/\/$/, '');

        const planLabel = plan === 'PRO' ? 'VIReyou PRO Subscription' : 'VIReyou Standard Subscription';

        // Convert USD to RUB (e.g., $7 -> 630 RUB)
        // We use a fixed exchange rate for predictability. You can adjust this later.
        const USD_TO_RUB_RATE = 90; 
        const rubAmount = amount * USD_TO_RUB_RATE;

        const paymentData: Record<string, any> = {
            do: 'pay',
            order_id: orderId,
            currency: 'rub',
            products: [
                {
                    name: planLabel,
                    price: Number(rubAmount).toFixed(2),
                    quantity: 1,
                }
            ],
            customer_email: authUser.email || '',
            customer_extra: `user_id:${user.id}|plan:${plan}`,
            urlSuccess: `${baseUrl}/${locale || 'en'}/cabinet/wallet?payment=success`,
            urlReturn: `${baseUrl}/${locale || 'en'}/cabinet/wallet?payment=cancelled`,
            urlNotification: `${baseUrl}/api/payments/prodamus-webhook`,
        };

        // Create HMAC signature
        paymentData.signature = createProdamusSignature(paymentData, secretKey);

        // Build payment URL as query string
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(paymentData)) {
            if (key === 'products') {
                (value as any[]).forEach((product, idx) => {
                    for (const [pKey, pVal] of Object.entries(product)) {
                        params.append(`products[${idx}][${pKey}]`, String(pVal));
                    }
                });
            } else {
                params.append(key, String(value));
            }
        }

        const paymentUrl = `${prodamusUrl}?${params.toString()}`;

        console.log(`[PRODAMUS] Creating payment for user ${user.email}, plan: ${plan}, amount: ${amount}`);

        return NextResponse.json({ payment_url: paymentUrl });

    } catch (error) {
        console.error('[PRODAMUS] Payment Create Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
