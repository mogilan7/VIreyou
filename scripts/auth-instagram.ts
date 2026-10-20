/**
 * Утилита обмена токена Instagram Graph API на Long-Lived Token (60 дней)
 * и автоматического определения Instagram Business Account ID.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

const envLocalPath = path.resolve(__dirname, '../.env.local');
dotenv.config({ path: envLocalPath });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const appId = process.env.META_APP_ID;
const appSecret = process.env.META_APP_SECRET;
const initialToken = process.env.META_USER_TOKEN || process.argv[2];

async function setupInstagramAuth() {
    console.log('[INSTAGRAM AUTH] Проверка конфигурации Meta Graph API...');

    if (!appId || !appSecret) {
        console.error(`
[INSTAGRAM AUTH] ОШИБКА: META_APP_ID или META_APP_SECRET не заданы в .env.local!

Инструкция:
1. Откройте Meta for Developers: https://developers.facebook.com/apps/
2. Создайте приложение типа "Business" / "Другое (Бизнес)".
3. В настройках добавьте разрешения (Use cases / Permissions):
   - instagram_basic
   - instagram_manage_insights
   - pages_read_engagement
   - pages_show_list
4. В разделе "Settings" -> "Basic" скопируйте App ID и App Secret в .env.local:
   META_APP_ID=ваш_app_id
   META_APP_SECRET=ваш_app_secret
5. Получите краткосрочный User Token через Graph API Explorer (https://developers.facebook.com/tools/explorer/)
   и запустите:
   npx tsx scripts/auth-instagram.ts <ваш_токен>
`);
        process.exit(1);
    }

    if (!initialToken) {
        console.error(`
[INSTAGRAM AUTH] Укажите токен в аргументе команды или в META_USER_TOKEN в .env.local:
Пример: npx tsx scripts/auth-instagram.ts EAAB...
`);
        process.exit(1);
    }

    console.log('[INSTAGRAM AUTH] 1. Обмен на Long-Lived User Token (60 дней)...');
    const exchangeUrl = `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${initialToken}`;

    const tokenRes = await fetch(exchangeUrl);
    const tokenData = await tokenRes.json();

    if (tokenData.error) {
        throw new Error(`Ошибка получения long-lived токена: ${tokenData.error.message}`);
    }

    const longLivedToken = tokenData.access_token;
    const expiresInSec = tokenData.expires_in || 5184000; // ~60 days
    const expiresAt = new Date(Date.now() + expiresInSec * 1000).toISOString();
    console.log(`✅ Long-lived токен получен (действует до ${expiresAt})`);

    console.log('[INSTAGRAM AUTH] 2. Поиск привязанной Facebook-страницы и Instagram Business Account...');
    const pagesUrl = `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token,instagram_business_account{id,username,name}&access_token=${longLivedToken}`;
    const pagesRes = await fetch(pagesUrl);
    const pagesData = await pagesRes.json();

    if (pagesData.error) {
        throw new Error(`Ошибка получения страниц: ${pagesData.error.message}`);
    }

    let foundIgId: string | null = null;
    let foundPageToken: string | null = null;
    let foundUsername: string | null = null;

    for (const page of pagesData.data || []) {
        if (page.instagram_business_account?.id) {
            foundIgId = page.instagram_business_account.id;
            foundUsername = page.instagram_business_account.username || 'unknown';
            foundPageToken = page.access_token;
            console.log(`✅ Найдена страница: "${page.name}" -> Instagram: @${foundUsername} (ID: ${foundIgId})`);
            break;
        }
    }

    if (!foundIgId) {
        console.warn(`
⚠️ Внимание: Ни на одной из ваших Facebook-страниц не найден привязанный Instagram Business/Creator аккаунт!
Проверьте:
1. Ваш Instagram @vi_beautylife должен быть переведен в "Профессиональный аккаунт" (Business или Creator) в приложении Instagram:
   Настройки -> Тип аккаунта -> Переключиться на профессиональный аккаунт.
2. В приложении Instagram или Facebook он должен быть связан с вашей страницей Facebook:
   Настройки Instagram -> Центр аккаунтов / Связанные аккаунты -> Страница Facebook.
`);
    }

    // Update .env.local
    let envContent = fs.existsSync(envLocalPath) ? fs.readFileSync(envLocalPath, 'utf8') : '';

    const updateEnvKey = (key: string, val: string) => {
        if (envContent.includes(`${key}=`)) {
            envContent = envContent.replace(new RegExp(`${key}=.*(\\r?\\n|$)`, 'g'), `${key}=${val}\n`);
        } else {
            envContent += `\n${key}=${val}\n`;
        }
    };

    updateEnvKey('INSTAGRAM_LONG_LIVED_TOKEN', longLivedToken);
    updateEnvKey('INSTAGRAM_TOKEN_EXPIRES_AT', expiresAt);
    if (foundIgId) updateEnvKey('INSTAGRAM_ACCOUNT_ID', foundIgId);
    if (foundPageToken) updateEnvKey('INSTAGRAM_PAGE_ACCESS_TOKEN', foundPageToken);

    fs.writeFileSync(envLocalPath, envContent, 'utf8');
    console.log('✅ Настройки Instagram успешно сохранены в .env.local!');
}

setupInstagramAuth().catch(err => {
    console.error('[INSTAGRAM AUTH] Ошибка:', err.message || err);
    process.exit(1);
});
