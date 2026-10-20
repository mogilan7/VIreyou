/**
 * Еженедельная выгрузка Instagram Graph API для аккаунта @vi_beautylife / VIReyou
 * Выгружает:
 * 1. Метрики аккаунта за 7 дней (reach, accounts_engaged, profile_views, website_clicks, follower_count)
 * 2. Метрики публикаций за 7 дней (тип, дата, reach, saved, shares, likes, comments, для reels: plays)
 * Сохраняет в: instagram_YYYY-MM-DD.csv на Google Drive и локально.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

const envLocalPath = path.resolve(__dirname, '../.env.local');
dotenv.config({ path: envLocalPath });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const appId = process.env.META_APP_ID;
const appSecret = process.env.META_APP_SECRET;
let token = process.env.INSTAGRAM_PAGE_ACCESS_TOKEN || process.env.INSTAGRAM_LONG_LIVED_TOKEN;
const igAccountId = process.env.INSTAGRAM_ACCOUNT_ID;

function getFormattedDate(offsetDays: number = 0): string {
    const d = new Date();
    d.setDate(d.getDate() - offsetDays);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

const escapeCsv = (val: any) => {
    const s = String(val ?? '');
    if (s.includes(';') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
        return '"' + s.split('"').join('""') + '"';
    }
    return s;
};

async function refreshTokenIfNeeded() {
    if (!token || !appId || !appSecret) return;
    try {
        const expiresAtStr = process.env.INSTAGRAM_TOKEN_EXPIRES_AT;
        if (expiresAtStr) {
            const expiresAt = new Date(expiresAtStr).getTime();
            const daysLeft = (expiresAt - Date.now()) / (1000 * 60 * 60 * 24);
            // Meta allows refreshing if token is at least 24h old and still valid
            if (daysLeft < 30) {
                console.log(`[INSTAGRAM EXPORT] Токен истекает через ${daysLeft.toFixed(1)} дн. Запрос на автоматическое продление...`);
                const refreshUrl = `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${token}`;
                const res = await fetch(refreshUrl);
                const data = await res.json();
                if (data.access_token) {
                    token = data.access_token;
                    const newExpiresAt = new Date(Date.now() + (data.expires_in || 5184000) * 1000).toISOString();
                    let envContent = fs.readFileSync(envLocalPath, 'utf8');
                    envContent = envContent.replace(/INSTAGRAM_LONG_LIVED_TOKEN=.*(\r?\n|$)/g, `INSTAGRAM_LONG_LIVED_TOKEN=${token}\n`);
                    envContent = envContent.replace(/INSTAGRAM_TOKEN_EXPIRES_AT=.*(\r?\n|$)/g, `INSTAGRAM_TOKEN_EXPIRES_AT=${newExpiresAt}\n`);
                    fs.writeFileSync(envLocalPath, envContent, 'utf8');
                    console.log(`[INSTAGRAM EXPORT] ✅ Токен успешно продлен до ${newExpiresAt}`);
                }
            }
        }
    } catch (e: any) {
        console.warn('[INSTAGRAM EXPORT] Предупреждение: Не удалось продлить токен:', e?.message || e);
    }
}

async function exportInstagramMetrics() {
    console.log('[INSTAGRAM EXPORT] Запуск выгрузки Instagram Graph API...');

    if (!token || !igAccountId) {
        console.warn(`
[INSTAGRAM EXPORT] ⚠️ Ключи Instagram не настроены в .env.local.
Требуются:
  META_APP_ID
  META_APP_SECRET
  INSTAGRAM_ACCOUNT_ID
  INSTAGRAM_LONG_LIVED_TOKEN

Для настройки запустите: npx tsx scripts/auth-instagram.ts
`);
        return null;
    }

    await refreshTokenIfNeeded();

    const csvLines: string[] = [];

    // --- 1. МЕТРИКИ АККАУНТА ЗА 7 ДНЕЙ ---
    csvLines.push(['=== 1. МЕТРИКИ АККАУНТА INSTAGRAM (@vi_beautylife) ЗА 7 ДНЕЙ ==='].map(escapeCsv).join(';'));
    csvLines.push(['Метрика', 'Значение', 'Примечание'].map(escapeCsv).join(';'));

    // Get follower count
    try {
        const infoUrl = `https://graph.facebook.com/v21.0/${igAccountId}?fields=name,username,followers_count,media_count&access_token=${token}`;
        const infoRes = await fetch(infoUrl);
        const infoData = await infoRes.json();

        if (infoData.followers_count !== undefined) {
            csvLines.push(['Количество подписчиков (Followers)', infoData.followers_count, 'Всего на текущий момент'].map(escapeCsv).join(';'));
            csvLines.push(['Всего публикаций (Media Count)', infoData.media_count, ''].map(escapeCsv).join(';'));
        }
    } catch (e: any) {
        console.warn('[INSTAGRAM EXPORT] Ошибка получения профиля:', e?.message || e);
        csvLines.push(['Количество подписчиков', '', 'Ошибка получения'].map(escapeCsv).join(';'));
    }

    // Account Insights (reach, accounts_engaged, profile_views, website_clicks)
    const sevenDaysAgoUnix = Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000);
    const nowUnix = Math.floor(Date.now() / 1000);

    const metricsToFetch = ['reach', 'accounts_engaged', 'profile_views', 'website_clicks'];
    for (const metric of metricsToFetch) {
        try {
            const url = `https://graph.facebook.com/v21.0/${igAccountId}/insights?metric=${metric}&period=day&since=${sevenDaysAgoUnix}&until=${nowUnix}&access_token=${token}`;
            const res = await fetch(url);
            const data = await res.json();

            if (data.data && data.data[0]?.values) {
                const total = data.data[0].values.reduce((sum: number, item: any) => sum + (Number(item.value) || 0), 0);
                csvLines.push([`Метрика: ${metric} (сумма за 7 дней)`, total, data.data[0].description || ''].map(escapeCsv).join(';'));
            } else if (data.error) {
                console.warn(`[INSTAGRAM EXPORT] Метрика ${metric} недоступна:`, data.error.message);
                csvLines.push([`Метрика: ${metric}`, '', `Не отдается API: ${data.error.message}`].map(escapeCsv).join(';'));
            } else {
                csvLines.push([`Метрика: ${metric}`, 0, 'Нет данных'].map(escapeCsv).join(';'));
            }
        } catch (err: any) {
            console.warn(`[INSTAGRAM EXPORT] Ошибка запроса ${metric}:`, err?.message || err);
            csvLines.push([`Метрика: ${metric}`, '', 'Ошибка запроса'].map(escapeCsv).join(';'));
        }
    }

    // --- 2. МЕТРИКИ ПУБЛИКАЦИЙ ЗА 7 ДНЕЙ ---
    csvLines.push('');
    csvLines.push(['=== 2. ПУБЛИКАЦИИ И REELS ЗА ПОСЛЕДНИЕ 7 ДНЕЙ ==='].map(escapeCsv).join(';'));
    csvLines.push([
        'ID поста',
        'Тип',
        'Дата публикации',
        'Текст / Подпись',
        'Охват (Reach)',
        'Сохранения (Saved)',
        'Шеринг (Shares)',
        'Лайки',
        'Комментарии',
        'Просмотры видео / Plays (Reels)'
    ].map(escapeCsv).join(';'));

    try {
        const mediaUrl = `https://graph.facebook.com/v21.0/${igAccountId}/media?fields=id,caption,media_type,media_product_type,timestamp,like_count,comments_count&since=${sevenDaysAgoUnix}&access_token=${token}`;
        const mediaRes = await fetch(mediaUrl);
        const mediaData = await mediaRes.json();

        for (const item of mediaData.data || []) {
            const isReel = item.media_product_type === 'REELS' || item.media_type === 'VIDEO';
            let reach = '';
            let saved = '';
            let shares = '';
            let plays = '';

            // Query media insights
            try {
                const insightMetrics = isReel
                    ? 'reach,saved,shares,plays'
                    : 'reach,saved';
                const insUrl = `https://graph.facebook.com/v21.0/${item.id}/insights?metric=${insightMetrics}&access_token=${token}`;
                const insRes = await fetch(insUrl);
                const insData = await insRes.json();

                for (const m of insData.data || []) {
                    const val = m.values?.[0]?.value ?? '';
                    if (m.name === 'reach') reach = val;
                    if (m.name === 'saved') saved = val;
                    if (m.name === 'shares') shares = val;
                    if (m.name === 'plays') plays = val;
                }
            } catch (insErr: any) {
                console.warn(`[INSTAGRAM EXPORT] Не удалось получить инсайты для медиа ${item.id}:`, insErr?.message || insErr);
            }

            const cleanCaption = (item.caption || '').replace(/\r?\n/g, ' ').slice(0, 100);

            csvLines.push([
                item.id,
                item.media_product_type || item.media_type || 'POST',
                item.timestamp ? item.timestamp.split('T')[0] : '',
                cleanCaption,
                reach,
                saved,
                shares,
                item.like_count ?? '',
                item.comments_count ?? '',
                plays
            ].map(escapeCsv).join(';'));
        }
    } catch (e: any) {
        console.warn('[INSTAGRAM EXPORT] Ошибка получения медиа:', e?.message || e);
        csvLines.push(['-', 'Данные недоступны', '', '', '', '', '', '', '', ''].map(escapeCsv).join(';'));
    }

    // Save CSV
    const csvContent = '\uFEFF' + csvLines.join('\r\n');
    const dateStr = getFormattedDate(0);
    const fileName = `instagram_${dateStr}.csv`;

    const gdriveDir = '/Users/mogilevandrei/Library/CloudStorage/GoogleDrive-mogilev.andrey@gmail.com/Мой диск/VIReyou/VIReyou_Аналитика';
    const localDir = path.resolve(__dirname, 'exports');

    const savedPaths: string[] = [];
    if (!fs.existsSync(localDir)) fs.mkdirSync(localDir, { recursive: true });
    const localFile = path.join(localDir, fileName);
    fs.writeFileSync(localFile, csvContent, 'utf8');
    savedPaths.push(localFile);

    if (fs.existsSync(gdriveDir)) {
        const gdriveFile = path.join(gdriveDir, fileName);
        fs.writeFileSync(gdriveFile, csvContent, 'utf8');
        savedPaths.push(gdriveFile);
        console.log(`[INSTAGRAM EXPORT] Сохранено на Google Drive: ${gdriveFile}`);
    }

    console.log(`[INSTAGRAM EXPORT] Успешно завершено: ${fileName}`);
    return { fileName, savedPaths, csvContent };
}

if (require.main === module) {
    exportInstagramMetrics()
        .then(() => process.exit(0))
        .catch(err => {
            console.error('[INSTAGRAM EXPORT] Ошибка:', err);
            process.exit(1);
        });
}

export { exportInstagramMetrics };
