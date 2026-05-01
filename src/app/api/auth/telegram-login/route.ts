import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');
    const locale = searchParams.get('locale') || 'ru';
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://vireyou.com';
    const dashboardUrl = `${siteUrl}/${locale}/cabinet/lifestyle`;

    // Guard: check required env vars at runtime
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !serviceKey || !anonKey) {
        console.error('[AUTH] Missing Supabase env vars:', { supabaseUrl: !!supabaseUrl, serviceKey: !!serviceKey, anonKey: !!anonKey });
        return NextResponse.redirect(new URL(`/${locale}/login?error=config`, req.url));
    }

    if (!token) {
        return NextResponse.redirect(new URL(`/${locale}/login`, req.url));
    }

    try {
        // 1. Verify the JWT token from the bot
        const secret = process.env.JWT_SECRET || process.env.YOOKASSA_SECRET_KEY || 'default_secret';
        const decoded = jwt.verify(token, secret) as { email: string };

        if (!decoded?.email) {
            throw new Error('Invalid token payload');
        }

        const email = decoded.email;

        // 2. Create admin client (inside handler = runtime only, not build time)
        const supabaseAdmin = createClient(supabaseUrl, serviceKey);

        // 3. Try to generate magic link directly — this also auto-creates user in Supabase Auth
        //    if email doesn't exist yet (as of Supabase 2.x admin API)
        let { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
            type: 'magiclink',
            email,
        });

        // If user not found — create them first, then try again
        if (linkError) {
            console.log(`[AUTH] generateLink error: ${linkError.message} — trying to create user`);
            await supabaseAdmin.auth.admin.createUser({
                email,
                email_confirm: true,
                user_metadata: { source: 'telegram_bot' }
            });
            const retry = await supabaseAdmin.auth.admin.generateLink({
                type: 'magiclink',
                email,
            });
            linkData = retry.data;
            linkError = retry.error;
        }

        if (linkError || !linkData?.properties?.hashed_token) {
            throw new Error(`Magic link generation failed: ${linkError?.message}`);
        }

        const hashedToken = linkData.properties.hashed_token;

        // 4. Return HTML page that verifies OTP client-side → session stored in localStorage
        //    localStorage persists between Telegram Mini App open/close, unlike cookies!
        const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Вход...</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { margin:0; display:flex; align-items:center; justify-content:center;
           min-height:100vh; background:#0f1117; font-family:sans-serif; flex-direction:column; }
    .icon { color:#60B76F; animation:spin 1s linear infinite; }
    @keyframes spin { to { transform:rotate(360deg); } }
    p { color:#94a3b8; margin-top:16px; font-size:14px; }
  </style>
</head>
<body>
  <svg class="icon" width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
  </svg>
  <p>Выполняется вход...</p>
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
  <script>
    (async function() {
      try {
        const client = supabase.createClient('${supabaseUrl}', '${anonKey}');
        const { data, error } = await client.auth.verifyOtp({
          token_hash: '${hashedToken}',
          type: 'magiclink'
        });
        if (error) {
          console.error('verifyOtp error:', error.message);
          window.location.href = '/${locale}/login?error=otp_failed';
          return;
        }
        window.location.href = '${dashboardUrl}';
      } catch(e) {
        console.error('Auth error:', e);
        window.location.href = '/${locale}/login?error=unexpected';
      }
    })();
  </script>
</body>
</html>`;

        return new NextResponse(html, {
            status: 200,
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });

    } catch (error: any) {
        console.error('[AUTH] Seamless login error:', error.message || error);
        return NextResponse.redirect(new URL(`/${locale}/login?error=auth_failed`, req.url));
    }
}
