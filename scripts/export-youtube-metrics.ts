/**
 * Еженедельная выгрузка YouTube Analytics API для канала @vireyou_ru (ID: UCWM0wgdL7oXzru22cEJwRIA)
 * Выгружает:
 * 1. Метрики по каждому видео и шортсу (просмотры, удержание, лайки, подписки, шеринг и т.д.)
 * 2. Источники трафика (insightTrafficSourceType)
 * 3. Итог по каналу (прирост и отток подписчиков)
 * Сохраняет в: youtube_YYYY-MM-DD.csv на Google Drive и локально.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { google } from 'googleapis';

const envLocalPath = path.resolve(__dirname, '../.env.local');
dotenv.config({ path: envLocalPath });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const CHANNEL_ID = process.env.YOUTUBE_CHANNEL_ID || 'UCWM0wgdL7oXzru22cEJwRIA';
const CLIENT_ID = process.env.YOUTUBE_CLIENT_ID;
const CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.YOUTUBE_REFRESH_TOKEN;

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

async function exportYouTubeMetrics() {
    console.log('[YOUTUBE EXPORT] Запуск выгрузки YouTube Analytics...');

    if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
        console.warn(`
[YOUTUBE EXPORT] ⚠️ YouTube API credentials не настроены в .env.local.
Требуются:
  YOUTUBE_CLIENT_ID
  YOUTUBE_CLIENT_SECRET
  YOUTUBE_REFRESH_TOKEN

Для первичной настройки запустите: npx tsx scripts/auth-youtube.ts
`);
        return null;
    }

    const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET);
    oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

    const youtubeAnalytics = google.youtubeAnalytics({ version: 'v2', auth: oauth2Client });
    const youtubeData = google.youtube({ version: 'v3', auth: oauth2Client });

    // YouTube Analytics API has a 2-day processing delay for finalized metrics
    // We compare [today - 8 .. today - 2] (last 7 completed days) vs [today - 15 .. today - 9]
    const lastStart = getFormattedDate(8);
    const lastEnd = getFormattedDate(2);
    const prevStart = getFormattedDate(15);
    const prevEnd = getFormattedDate(9);

    console.log(`[YOUTUBE EXPORT] Период: ${lastStart} — ${lastEnd} (сравнение с ${prevStart} — ${prevEnd})`);

    const csvLines: string[] = [];

    // --- 1. ИТОГ ПО КАНАЛУ ---
    csvLines.push(['=== 1. ИТОГИ ПО КАНАЛУ (@vireyou_ru / UCWM0wgdL7oXzru22cEJwRIA) ==='].map(escapeCsv).join(';'));
    csvLines.push([
        'Метрика',
        `Последние 7 дней (${lastStart} — ${lastEnd})`,
        `Предыдущие 7 дней (${prevStart} — ${prevEnd})`,
        'Динамика'
    ].map(escapeCsv).join(';'));

    try {
        const [lastChannelStats, prevChannelStats] = await Promise.all([
            youtubeAnalytics.reports.query({
                ids: `channel==${CHANNEL_ID}`,
                startDate: lastStart,
                endDate: lastEnd,
                metrics: 'views,estimatedMinutesWatched,averageViewDuration,subscribersGained,subscribersLost,likes,comments,shares'
            }),
            youtubeAnalytics.reports.query({
                ids: `channel==${CHANNEL_ID}`,
                startDate: prevStart,
                endDate: prevEnd,
                metrics: 'views,estimatedMinutesWatched,averageViewDuration,subscribersGained,subscribersLost,likes,comments,shares'
            })
        ]);

        const lastRow = lastChannelStats.data.rows?.[0] || [];
        const prevRow = prevChannelStats.data.rows?.[0] || [];
        const headers = (lastChannelStats.data.columnHeaders || []).map(h => h.name);

        const getVal = (row: any[], name: string) => {
            const idx = headers.indexOf(name);
            return idx !== -1 ? Number(row[idx] || 0) : 0;
        };

        const metricsToReport = [
            { label: 'Просмотры (Views)', key: 'views' },
            { label: 'Время просмотра (минут)', key: 'estimatedMinutesWatched' },
            { label: 'Средняя длительность просмотра (сек)', key: 'averageViewDuration' },
            { label: 'Новые подписчики (+)', key: 'subscribersGained' },
            { label: 'Отписавшиеся (-)', key: 'subscribersLost' },
            { label: 'Чистый прирост подписчиков (Net)', calc: (r: any[]) => getVal(r, 'subscribersGained') - getVal(r, 'subscribersLost') },
            { label: 'Лайки', key: 'likes' },
            { label: 'Комментарии', key: 'comments' },
            { label: 'Поделились (Shares)', key: 'shares' }
        ];

        for (const m of metricsToReport) {
            const lVal = m.calc ? m.calc(lastRow) : getVal(lastRow, m.key!);
            const pVal = m.calc ? m.calc(prevRow) : getVal(prevRow, m.key!);
            const diff = pVal === 0 ? (lVal > 0 ? '+100%' : '0%') : `${((lVal - pVal) / pVal * 100) > 0 ? '+' : ''}${(((lVal - pVal) / pVal) * 100).toFixed(1)}%`;
            csvLines.push([m.label, lVal, pVal, diff].map(escapeCsv).join(';'));
        }
    } catch (e: any) {
        console.warn('[YOUTUBE EXPORT] Предупреждение: не удалось получить сводку канала:', e?.message || e);
        csvLines.push(['Сводка канала', 'Недоступно', 'Недоступно', '-'].map(escapeCsv).join(';'));
    }

    // --- 2. МЕТРИКИ ПО КАЖДОМУ ВИДЕО И ШОРТСУ ---
    csvLines.push('');
    csvLines.push(['=== 2. СТАТИСТИКА ПО РОЛИКАМ И SHORTS ЗА ПОСЛЕДНИЕ 7 ДНЕЙ ==='].map(escapeCsv).join(';'));
    csvLines.push([
        'ID видео',
        'Название видео',
        'Тип',
        'Просмотры',
        'Минут просмотра',
        'Ср. длит. просмотра (сек)',
        'Удержание (%)',
        'Подписчики (+)',
        'Лайки',
        'Комменты',
        'Шеринг',
        'Показы (Impressions)',
        'CTR показов (%)'
    ].map(escapeCsv).join(';'));

    try {
        const videoReport = await youtubeAnalytics.reports.query({
            ids: `channel==${CHANNEL_ID}`,
            startDate: lastStart,
            endDate: lastEnd,
            dimensions: 'video',
            metrics: 'views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,subscribersGained,likes,comments,shares',
            sort: '-views',
            maxResults: 50
        });

        const vRows = videoReport.data.rows || [];
        const videoIds = vRows.map(r => r[0]);

        // Fetch video titles & duration from YouTube Data API
        const videoMetaMap = new Map<string, { title: string; isShort: boolean }>();
        if (videoIds.length > 0) {
            try {
                const chunks = [];
                for (let i = 0; i < videoIds.length; i += 50) {
                    chunks.push(videoIds.slice(i, i + 50));
                }
                for (const chunk of chunks) {
                    const metaRes = await youtubeData.videos.list({
                        id: chunk,
                        part: ['snippet', 'contentDetails']
                    });
                    for (const item of metaRes.data.items || []) {
                        const duration = item.contentDetails?.duration || '';
                        // PT60S or less without minutes is typically Shorts
                        const isShort = duration.includes('S') && !duration.includes('M') && !duration.includes('H');
                        videoMetaMap.set(item.id!, {
                            title: item.snippet?.title || item.id!,
                            isShort
                        });
                    }
                }
            } catch (err: any) {
                console.warn('[YOUTUBE EXPORT] Предупреждение: Не удалось загрузить названия видео из Data API:', err?.message || err);
            }
        }

        for (const row of vRows) {
            const vId = row[0];
            const meta = videoMetaMap.get(vId) || { title: `Видео ${vId}`, isShort: false };
            const views = row[1];
            const watchMin = row[2];
            const avgDuration = row[3];
            const avgPct = row[4];
            const subs = row[5];
            const likes = row[6];
            const comments = row[7];
            const shares = row[8];

            // Impressions & CTR might not be exposed at per-video breakdown via v2 query for all account tiers
            const impressions = '';
            const ctr = '';

            csvLines.push([
                vId,
                meta.title,
                meta.isShort ? 'Shorts' : 'Video',
                views,
                watchMin,
                avgDuration,
                avgPct !== null && avgPct !== undefined ? `${Number(avgPct).toFixed(1)}%` : '',
                subs,
                likes,
                comments,
                shares,
                impressions,
                ctr
            ].map(escapeCsv).join(';'));
        }
    } catch (e: any) {
        console.warn('[YOUTUBE EXPORT] Предупреждение: Ошибка запроса статистики видео:', e?.message || e);
        csvLines.push(['-', 'Данные временно недоступны', '-', '', '', '', '', '', '', '', '', '', ''].map(escapeCsv).join(';'));
    }

    // --- 3. ИСТОЧНИКИ ТРАФИКА ---
    csvLines.push('');
    csvLines.push(['=== 3. ИСТОЧНИКИ ТРАФИКА ЗА ПОСЛЕДНИЕ 7 ДНЕЙ ==='].map(escapeCsv).join(';'));
    csvLines.push([
        'Источник трафика (insightTrafficSourceType)',
        'Просмотры',
        'Минут просмотра'
    ].map(escapeCsv).join(';'));

    try {
        const trafficReport = await youtubeAnalytics.reports.query({
            ids: `channel==${CHANNEL_ID}`,
            startDate: lastStart,
            endDate: lastEnd,
            dimensions: 'insightTrafficSourceType',
            metrics: 'views,estimatedMinutesWatched',
            sort: '-views'
        });

        for (const row of trafficReport.data.rows || []) {
            csvLines.push([row[0], row[1], row[2]].map(escapeCsv).join(';'));
        }
    } catch (e: any) {
        console.warn('[YOUTUBE EXPORT] Предупреждение: Ошибка запроса источников трафика:', e?.message || e);
        csvLines.push(['Данные недоступны', '', ''].map(escapeCsv).join(';'));
    }

    // Save CSV
    const csvContent = '\uFEFF' + csvLines.join('\r\n');
    const dateStr = getFormattedDate(0);
    const fileName = `youtube_${dateStr}.csv`;

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
        console.log(`[YOUTUBE EXPORT] Сохранено на Google Drive: ${gdriveFile}`);
    }

    console.log(`[YOUTUBE EXPORT] Успешно завершено: ${fileName}`);
    return { fileName, savedPaths, csvContent };
}

if (require.main === module) {
    exportYouTubeMetrics()
        .then(() => process.exit(0))
        .catch(err => {
            console.error('[YOUTUBE EXPORT] Ошибка:', err);
            process.exit(1);
        });
}

export { exportYouTubeMetrics };
