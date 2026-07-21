import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
        
        const supabaseAdmin = createClient(supabaseUrl.trim(), serviceKey.trim());
        
        const email = 'mogilev.andrey@gmail.com';
        
        let { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
            type: 'magiclink',
            email,
        });

        if (linkError) {
            return NextResponse.json({ error: 'generateLink failed', details: linkError });
        }

        const actionLink = linkData.properties.action_link;
        const actionUrl = new URL(actionLink);
        const tokenHash = actionUrl.searchParams.get('token');

        const supabaseServer = await createServerClient();
        const { error: verifyError, data } = await supabaseServer.auth.verifyOtp({
            token_hash: tokenHash!,
            type: 'magiclink',
        });

        if (verifyError) {
            return NextResponse.json({ error: 'verifyOtp failed', details: verifyError, tokenHash });
        }

        return NextResponse.json({ success: true, session: !!data.session });
    } catch (e: any) {
        return NextResponse.json({ error: 'Exception', message: e.message });
    }
}
