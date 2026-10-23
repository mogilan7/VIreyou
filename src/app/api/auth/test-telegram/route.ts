import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const email = searchParams.get('email') || 'mogilev.andrey@gmail.com';

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
        const supabaseAdmin = createClient(supabaseUrl.trim(), serviceKey.trim());

        let { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
            type: 'magiclink',
            email,
        });

        let createdUser = false;
        if (linkError && (linkError.message?.includes('User not found') || linkError.status === 422)) {
            const createRes = await supabaseAdmin.auth.admin.createUser({
                email,
                email_confirm: true,
                user_metadata: { source: 'telegram_bot' }
            });
            createdUser = true;

            const retry = await supabaseAdmin.auth.admin.generateLink({
                type: 'magiclink',
                email,
            });
            linkData = retry.data;
            linkError = retry.error;
        }

        if (linkError || !linkData?.properties) {
            return NextResponse.json({ error: 'generateLink failed', linkError, createdUser });
        }

        const properties = linkData.properties as any;
        const actionUrl = new URL(properties.action_link);
        const queryToken = actionUrl.searchParams.get('token');
        const tokenHash = properties.hashed_token || queryToken;
        const otpType = properties.verification_type || 'magiclink';

        const supabaseServer = await createServerClient();
        const { error: verifyError, data: verifyData } = await supabaseServer.auth.verifyOtp({
            token_hash: tokenHash,
            type: otpType,
        });

        return NextResponse.json({
            createdUser,
            properties,
            tokenHash,
            queryToken,
            otpType,
            verifyError,
            session: !!verifyData?.session
        });
    } catch (e: any) {
        return NextResponse.json({ error: 'Exception', message: e.message });
    }
}
