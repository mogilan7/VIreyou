/**
 * Еженедельная выгрузка Instagram Graph API для аккаунта @vi_beautylife
 * Выгружает:
 * 1. Метрики аккаунта (подписчики, общий охват, охват по подписчикам и не подписчикам, вовлеченность, клики)
 * 2. Публикации и Reels за 7 дней (тип: карусель / рилс / фото, охват, сохранения, репосты, лайки, комментарии, подписки, посещения профиля)
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
const igAccountId = process.env.INSTAGRAM_ACCOUNT_ID;
let token = process.env.INSTAGRAM_LONG_LIVED_TOKEN;

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
    const expiresAtStr = process.env.INSTAGRAM_TOKEN_EXPIRES_AT;
    if (!expiresAtStr || !token || !appSecret) return;

    try {
        const expiresAt = new Date(expiresAtStr).getTime();
        const daysLeft = (expiresAt - Date.now()) / (1000 * 3600 * 24);

        if (daysLeft < 7) {
            console.log(`[INSTAGRAM EXPORT] Токен истекает через ${daysLeft.toFixed(1)} дней. Обновляем...`);
            const refreshUrl = `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${token}`;
            const res = await fetch(refreshUrl);
            const data = await res.json();

            if (data.access_token) {
                token = data.access_token;
                const newExpires = new Date(Date.now() + (data.expires_in || 5184000) * 1000).toISOString();

                // Save back to .env.local
                if (fs.existsSync(envLocalPath)) {
                    let content = fs.readFileSync(envLocalPath, 'utf8');
                    content = content.replace(/^INSTAGRAM_LONG_LIVED_TOKEN=.*$/m, `INSTAGRAM_LONG_LIVED_TOKEN=${token}`);
                    content = content.replace(/^INSTAGRAM_TOKEN_EXPIRES_AT=.*$/m, `INSTAGRAM_TOKEN_EXPIRES_AT=${newExpires}`);
                    fs.writeFileSync(envLocalPath, content, 'utf8');
                    console.log(`[INSTAGRAM EXPORT] Токен успешно обновлен в .env.local! Истекает: ${newExpires}`);
                }
            }
        }
    } catch (e: any) {
        console.warn('[INSTAGRAM EXPORT] Не удалось обновить токен:', e?.message || e);
    }
}

function getMediaTypeName(item: any): string {
    const mediaType = (item.media_type || '').toUpperCase();
    const productType = (item.media_product_type || '').toUpperCase();

    if (mediaType === 'CAROUSEL_ALBUM') return 'Карусель';
    if (productType === 'REELS' || mediaType === 'VIDEO') return 'Рилс';
    if (mediaType === 'IMAGE') return 'Фото';
    return productType || mediaType || 'Публикация';
}

async function exportInstagramMetrics() {
    console.log('[INSTAGRAM EXPORT] Запуск выгрузки Instagram Graph API...');

    if (!token || !igAccountId) {
        throw new Error('Instagram keys not configured in .env.local (INSTAGRAM_LONG_LIVED_TOKEN, INSTAGRAM_ACCOUNT_ID)');
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

        if (infoData.error) {
            throw new Error(`Instagram API Error: ${infoData.error.message || 'unknown error'} (code: ${infoData.error.code})`);
        }
        if (infoData.followers_count !== undefined) {
            csvLines.push(['Количество подписчиков (Followers)', infoData.followers_count, 'Всего на текущий момент'].map(escapeCsv).join(';'));
            csvLines.push(['Всего публикаций (Media Count)', infoData.media_count, ''].map(escapeCsv).join(';'));
        } else {
            throw new Error('Instagram API returned invalid profile response');
        }
    } catch (e: any) {
        throw e;
    }

    // Account Insights
    const sevenDaysAgoUnix = Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000);
    const nowUnix = Math.floor(Date.now() / 1000);

    const metricsToFetch = [
        { name: 'reach', type: 'values' },
        { name: 'accounts_engaged', type: 'total_value' },
        { name: 'profile_views', type: 'total_value' },
        { name: 'website_clicks', type: 'total_value' }
    ];

    for (const m of metricsToFetch) {
        try {
            const metricTypeParam = m.type === 'total_value' ? '&metric_type=total_value' : '';
            const url = `https://graph.facebook.com/v21.0/${igAccountId}/insights?metric=${m.name}${metricTypeParam}&period=day&since=${sevenDaysAgoUnix}&until=${nowUnix}&access_token=${token}`;
            const res = await fetch(url);
            const data = await res.json();

            if (data.data && data.data[0]) {
                const first = data.data[0];
                let total = 0;
                if (first.total_value !== undefined && first.total_value?.value !== undefined) {
                    total = Number(first.total_value.value) || 0;
                } else if (first.values) {
                    total = first.values.reduce((sum: number, item: any) => sum + (Number(item.value) || 0), 0);
                }
                csvLines.push([`Метрика: ${m.name} (сумма за 7 дней)`, total, first.description || ''].map(escapeCsv).join(';'));
            } else if (data.error) {
                console.warn(`[INSTAGRAM EXPORT] Метрика ${m.name} недоступна:`, data.error.message);
                csvLines.push([`Метрика: ${m.name}`, '', `Не отдается API: ${data.error.message}`].map(escapeCsv).join(';'));
            } else {
                csvLines.push([`Метрика: ${m.name}`, 0, 'Нет данных'].map(escapeCsv).join(';'));
            }
        } catch (err: any) {
            console.warn(`[INSTAGRAM EXPORT] Ошибка запроса ${m.name}:`, err?.message || err);
            csvLines.push([`Метрика: ${m.name}`, '', 'Ошибка запроса'].map(escapeCsv).join(';'));
        }
    }

    // Разбивка охвата по подписчикам и не-подписчикам
    try {
        const breakdownUrl = `https://graph.facebook.com/v21.0/${igAccountId}/insights?metric=reach&period=day&breakdown=follow_type&metric_type=total_value&since=${sevenDaysAgoUnix}&until=${nowUnix}&access_token=${token}`;
        const bRes = await fetch(breakdownUrl);
        const bData = await bRes.json();

        if (bData.data && bData.data[0]) {
            const breakdowns = bData.data[0]?.total_value?.breakdowns?.[0]?.results || [];
            let followersReach = 0;
            let nonFollowersReach = 0;

            for (const r of breakdowns) {
                const typeVal = r.dimension_values?.[0];
                if (typeVal === 'FOLLOWER') followersReach = Number(r.value) || 0;
                if (typeVal === 'NON_FOLLOWER') nonFollowersReach = Number(r.value) || 0;
            }

            const totalReachBreakdown = followersReach + nonFollowersReach;
            const nonFollowerPct = totalReachBreakdown > 0 ? ((nonFollowersReach / totalReachBreakdown) * 100).toFixed(1) : '0.0';

            csvLines.push(['Охват: Подписчики (Followers)', followersReach, 'Уникальные подписчики, видевшие контент за 7 дней'].map(escapeCsv).join(';'));
            csvLines.push(['Охват: Не подписчики (Non-followers)', nonFollowersReach, 'Уникальные не-подписчики, видевшие контент за 7 дней'].map(escapeCsv).join(';'));
            csvLines.push(['Доля охвата от не-подписчиков (%)', `${nonFollowerPct}%`, 'Процент вирального/нового охвата'].map(escapeCsv).join(';'));
        } else if (bData.error) {
            console.warn('[INSTAGRAM EXPORT] Разделение охвата недоступно:', bData.error.message);
            csvLines.push(['Охват по подписчикам и не-подписчикам', '', `Не отдается API: ${bData.error.message}`].map(escapeCsv).join(';'));
        }
    } catch (bErr: any) {
        console.warn('[INSTAGRAM EXPORT] Ошибка получения разбивки охвата:', bErr?.message || bErr);
    }

    // --- 2. МЕТРИКИ ПУБЛИКАЦИЙ ЗА 7 ДНЕЙ ---
    csvLines.push('');
    csvLines.push(['=== 2. ПУБЛИКАЦИИ И REELS ЗА ПОСЛЕДНИЕ 7 ДНЕЙ ==='].map(escapeCsv).join(';'));
    csvLines.push([
        'ID поста',
        'Тип (карусель / рилс / фото)',
        'Дата публикации',
        'Текст / Подпись',
        'Охват (Reach)',
        'Сохранения (Saved)',
        'Репосты / Шеринг (Shares)',
        'Лайки',
        'Комментарии',
        'Подписки с публикации (Follows)',
        'Посещения профиля (Profile Visits)',
        'Просмотры (Views / Plays)'
    ].map(escapeCsv).join(';'));

    try {
        const mediaUrl = `https://graph.facebook.com/v21.0/${igAccountId}/media?fields=id,caption,media_type,media_product_type,timestamp,like_count,comments_count&since=${sevenDaysAgoUnix}&access_token=${token}`;
        const mediaRes = await fetch(mediaUrl);
        const mediaData = await mediaRes.json();

        for (const item of mediaData.data || []) {
            const typeLabel = getMediaTypeName(item);
            let reach = '';
            let saved = '';
            let shares = '';
            let plays = '';
            let follows = '';
            let profileVisits = '';

            // Query media insights (including follows and profile_visits)
            try {
                const insUrl = `https://graph.facebook.com/v21.0/${item.id}/insights?metric=reach,saved,shares,views,follows,profile_visits&access_token=${token}`;
                const insRes = await fetch(insUrl);
                const insData = await insRes.json();

                if (insData.data) {
                    for (const m of insData.data) {
                        const val = m.values?.[0]?.value ?? m.total_value?.value ?? '';
                        if (m.name === 'reach') reach = String(val);
                        if (m.name === 'saved') saved = String(val);
                        if (m.name === 'shares') shares = String(val);
                        if (m.name === 'views' || m.name === 'plays') plays = String(val);
                        if (m.name === 'follows') follows = String(val);
                        if (m.name === 'profile_visits' || m.name === 'profile_activity') profileVisits = String(val);
                    }
                } else if (insData.error) {
                    // Fallback to simpler metric set if unsupported
                    const fallbackUrl = `https://graph.facebook.com/v21.0/${item.id}/insights?metric=reach,saved,shares&access_token=${token}`;
                    const fbRes = await fetch(fallbackUrl);
                    const fbData = await fbRes.json();
                    for (const m of fbData.data || []) {
                        const val = m.values?.[0]?.value ?? '';
                        if (m.name === 'reach') reach = String(val);
                        if (m.name === 'saved') saved = String(val);
                        if (m.name === 'shares') shares = String(val);
                    }
                }
            } catch (insErr: any) {
                console.warn(`[INSTAGRAM EXPORT] Не удалось получить инсайты для медиа ${item.id}:`, insErr?.message || insErr);
            }

            const cleanCaption = (item.caption || '').replace(/\r?\n/g, ' ').slice(0, 100);

            csvLines.push([
                item.id,
                typeLabel,
                item.timestamp ? item.timestamp.split('T')[0] : '',
                cleanCaption,
                reach,
                saved,
                shares,
                item.like_count ?? '',
                item.comments_count ?? '',
                follows,
                profileVisits,
                plays
            ].map(escapeCsv).join(';'));
        }
    } catch (e: any) {
        console.warn('[INSTAGRAM EXPORT] Ошибка получения медиа:', e?.message || e);
        csvLines.push(['-', 'Данные недоступны', '', '', '', '', '', '', '', '', '', ''].map(escapeCsv).join(';'));
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
        console.log(`[INSTAGRAM EXPORT] Сохранено на Google Drive: ${gdriveFile}`);
    }

    console.log(`[INSTAGRAM EXPORT] Успешно завершено: ${fileName}`);
    return { fileName, savedPaths, csvContent };
}

if (require.main === module) {
    exportInstagramMetrics()
        .then(() => process.exit(0))
        .catch(err => {
            console.error('[INSTAGRAM EXPORT] [ERROR]:', err?.message || err);
            process.exit(1);
        });
}

export { exportInstagramMetrics };
