import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');
    const locale = searchParams.get('locale') || 'ru';
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://vireyou.com';
    const dashboardUrl = `${siteUrl}/${locale}/cabinet/lifestyle`;

    // 1. Check environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !serviceKey || !anonKey) {
        console.error('[AUTH] Missing Supabase env vars');
        return NextResponse.json({ error: 'Config error' }, { status: 500 });
    }

    if (!token) {
        return NextResponse.redirect(new URL(`/${locale}/login`, req.url));
    }

    try {
        const supabaseAdmin = createClient(supabaseUrl, serviceKey);

        // 2. Verify the JWT token from the bot
        const secret = process.env.JWT_SECRET || process.env.YOOKASSA_SECRET_KEY || 'default_secret';
        const decoded = jwt.verify(token, secret) as { email: string };

        if (!decoded || !decoded.email) {
            throw new Error('Invalid token');
        }

        const email = decoded.email;

        // 3. Generate a magic link to get a hashed_token
        let { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
            type: 'magiclink',
            email,
        });

        // Auto-create user if not found
        if (linkError && (linkError.message.includes('User not found') || linkError.status === 422)) {
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
            throw new Error('Link generation failed');
        }

        const hashedToken = linkData.properties.hashed_token;

        // 4. Return the "Blinking Bot" loading page that sets the session
        const html = `<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta charset="utf-8">
  <title>VIReyou Login</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { margin: 0; display: flex; align-items: center; justify-content: center; 
           min-height: 100vh; background: #0f1117; font-family: sans-serif; flex-direction: column; }
    .bot-icon { color: #60B76F; animation: pulse 1.5s ease-in-out infinite; }
    @keyframes pulse { 0% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.1); opacity: 0.7; } 100% { transform: scale(1); opacity: 1; } }
    .loader { margin-top: 20px; width: 30px; height: 30px; border: 3px solid rgba(96, 183, 111, 0.2); 
              border-radius: 50%; border-top-color: #60B76F; animation: spin 1s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    p { color: #94a3b8; margin-top: 20px; font-size: 14px; letter-spacing: 0.5px; }
  </style>
</head>
<body>
  <div class="bot-icon">
    <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 8V4H8"></path><rect width="16" height="12" x="4" y="8" rx="2"></rect><path d="M2 14h2"></path><path d="M20 14h2"></path><path d="M15 13v2"></path><path d="M9 13v2"></path>
    </svg>
  </div>
  <div class="loader"></div>
  <p>Синхронизация профиля...</p>
  
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
  <script>
    (async function() {
      try {
        const client = supabase.createClient('${supabaseUrl}', '${anonKey}');
        const { error } = await client.auth.verifyOtp({
          token_hash: '${hashedToken}',
          type: 'magiclink'
        });
        if (error) throw error;
        window.location.replace('${dashboardUrl}');
      } catch (e) {
        console.error(e);
        window.location.replace('/${locale}/login?error=auth_failed');
      }
    })();
  </script>
</body>
</html>`;

        return new NextResponse(html, {
            status: 200,
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });

    } catch (err: any) {
        console.error('[AUTH] Error:', err.message);
        return NextResponse.redirect(new URL(`/${locale}/login?error=error`, req.url));
    }
}
