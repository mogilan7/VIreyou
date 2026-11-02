/**
 * Еженедельная выгрузка YouTube Analytics API для канала @vireyou_ru (ID: UCWM0wgdL7oXzru22cEJwRIA)
 * Выгружает:
 * 1. Итоги по каналу: динамика за 7 дней + общее число подписчиков и часы просмотра длинных видео за 365 дней (прогресс YPP)
 * 2. Метрики по каждому ролику и Shorts за последние 7 дней (включая статус показов и CTR)
 * 3. Метрики по каждому ролику за всё время (просмотры, минуты, средний % просмотра, подписки)
 * 4. Источники трафика (insightTrafficSourceType)
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

function checkFatalAuthError(err: any) {
    const msg = err?.message || err?.toString() || '';
    if (msg.includes('invalid_grant') || err?.code === 401 || err?.response?.data?.error === 'invalid_grant') {
        throw new Error('invalid_grant: Google OAuth token expired or revoked');
    }
}

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
    const lastStart = getFormattedDate(8);
    const lastEnd = getFormattedDate(2);
    const prevStart = getFormattedDate(15);
    const prevEnd = getFormattedDate(9);

    console.log(`[YOUTUBE EXPORT] Период: ${lastStart} — ${lastEnd} (сравнение с ${prevStart} — ${prevEnd})`);

    const csvLines: string[] = [];

    // --- 1. ИТОГ ПО КАНАЛУ И ПРОГРЕСС МОНЕТИЗАЦИИ ---
    csvLines.push(['=== 1. ИТОГИ ПО КАНАЛУ (@vireyou_ru / UCWM0wgdL7oXzru22cEJwRIA) ==='].map(escapeCsv).join(';'));
    csvLines.push([
        'Метрика',
        `Последние 7 дней (${lastStart} — ${lastEnd})`,
        `Предыдущие 7 дней (${prevStart} — ${prevEnd})`,
        'Динамика / Общий итог'
    ].map(escapeCsv).join(';'));

    let channelTotalSubs = 0;
    try {
        const chRes = await youtubeData.channels.list({
            id: [CHANNEL_ID],
            part: ['statistics', 'snippet']
        });
        const chStats = chRes.data.items?.[0]?.statistics;
        if (chStats) {
            channelTotalSubs = Number(chStats.subscriberCount) || 0;
        }
    } catch (e: any) {
        checkFatalAuthError(e);
        console.warn('[YOUTUBE EXPORT] Предупреждение: не удалось получить статистику канала:', e?.message || e);
    }

    // Расчет часов просмотра длинных видео за последние 365 дней (для YPP)
    const d365Start = getFormattedDate(367);
    const d365End = getFormattedDate(2);
    let watchHours365Long = 0;
    let watchHours365Shorts = 0;

    // Кеш метаданных всех видео (title, duration, publishedAt, isShort)
    const videoMetaMap = new Map<string, { title: string; isShort: boolean; publishedAt: string; duration: string }>();

    try {
        const rep365 = await youtubeAnalytics.reports.query({
            ids: `channel==${CHANNEL_ID}`,
            startDate: d365Start,
            endDate: d365End,
            dimensions: 'video',
            metrics: 'views,estimatedMinutesWatched',
            sort: '-estimatedMinutesWatched',
            maxResults: 200
        });

        const v365Ids = (rep365.data.rows || []).map(r => r[0]);
        for (let i = 0; i < v365Ids.length; i += 50) {
            const chunk = v365Ids.slice(i, i + 50);
            const m = await youtubeData.videos.list({
                id: chunk,
                part: ['snippet', 'contentDetails']
            });
            for (const item of m.data.items || []) {
                const dur = item.contentDetails?.duration || '';
                const isShort = dur.includes('S') && !dur.includes('M') && !dur.includes('H');
                videoMetaMap.set(item.id!, {
                    title: item.snippet?.title || item.id!,
                    isShort,
                    publishedAt: item.snippet?.publishedAt ? item.snippet.publishedAt.slice(0, 10) : '',
                    duration: dur
                });
            }
        }

        let longMinutes = 0;
        let shortMinutes = 0;
        for (const r of rep365.data.rows || []) {
            const meta = videoMetaMap.get(r[0]);
            const mins = Number(r[1]) || 0;
            if (meta && !meta.isShort) {
                longMinutes += mins;
            } else {
                shortMinutes += mins;
            }
        }
        watchHours365Long = Number((longMinutes / 60).toFixed(1));
        watchHours365Shorts = Number((shortMinutes / 60).toFixed(1));
    } catch (err: any) {
        checkFatalAuthError(err);
        console.warn('[YOUTUBE EXPORT] Предупреждение: ошибка расчета 365-дневных часов:', err?.message || err);
    }

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

        // Блок прогресса к партнерской программе (YPP)
        csvLines.push(['--- ПРОГРЕСС К МОНЕТИЗАЦИИ (YPP) ---', '', '', ''].map(escapeCsv).join(';'));
        const subProgressPct = ((channelTotalSubs / 1000) * 100).toFixed(1);
        csvLines.push([
            'Общее число подписчиков (Всего)',
            channelTotalSubs,
            'Цель: 1 000',
            `Прогресс: ${channelTotalSubs}/1000 (${subProgressPct}%)`
        ].map(escapeCsv).join(';'));

        const hoursProgressPct = ((watchHours365Long / 4000) * 100).toFixed(1);
        csvLines.push([
            'Часы просмотра длинных видео (за 365 дней)',
            `${watchHours365Long} ч`,
            'Цель: 4 000 ч',
            `Прогресс: ${watchHours365Long}/4000 ч (${hoursProgressPct}%)`
        ].map(escapeCsv).join(';'));

        csvLines.push([
            'Часы просмотра Shorts (за 365 дней, справочно)',
            `${watchHours365Shorts} ч`,
            'Альтернатива YPP: 10M просмотров',
            `${watchHours365Shorts} ч`
        ].map(escapeCsv).join(';'));

    } catch (e: any) {
        checkFatalAuthError(e);
        console.warn('[YOUTUBE EXPORT] Предупреждение: не удалось получить сводку канала:', e?.message || e);
        csvLines.push(['Сводка канала', 'Недоступно', 'Недоступно', '-'].map(escapeCsv).join(';'));
    }

    // --- 2. МЕТРИКИ ПО КАЖДОМУ ВИДЕО И ШОРТСУ ЗА 7 ДНЕЙ ---
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

    // Проверка поддержки показов и CTR в API
    let impressionsSupported = false;
    let impressionsErrorMsg = 'Не отдаётся API (Ошибка: The query is not supported; метрики показов доступны только в YouTube Studio)';
    try {
        await youtubeAnalytics.reports.query({
            ids: `channel==${CHANNEL_ID}`,
            startDate: lastStart,
            endDate: lastEnd,
            dimensions: 'video',
            metrics: 'views,videoThumbnailImpressions,videoThumbnailImpressionsClickRate',
            maxResults: 1
        });
        impressionsSupported = true;
    } catch (impErr: any) {
        impressionsErrorMsg = `Не отдаётся API (Ошибка: ${impErr?.message || 'The query is not supported'}; показы доступны только в YouTube Studio)`;
    }

    try {
        const videoReport = await youtubeAnalytics.reports.query({
            ids: `channel==${CHANNEL_ID}`,
            startDate: lastStart,
            endDate: lastEnd,
            dimensions: 'video',
            metrics: 'views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,subscribersGained,likes,comments,shares',
            sort: '-views',
            maxResults: 100
        });

        const vRows = videoReport.data.rows || [];
        const videoIds = vRows.map(r => r[0]);

        // Подгружаем метаданные, которых нет в кеше
        const missingIds = videoIds.filter(id => !videoMetaMap.has(id));
        if (missingIds.length > 0) {
            try {
                for (let i = 0; i < missingIds.length; i += 50) {
                    const chunk = missingIds.slice(i, i + 50);
                    const metaRes = await youtubeData.videos.list({
                        id: chunk,
                        part: ['snippet', 'contentDetails']
                    });
                    for (const item of metaRes.data.items || []) {
                        const dur = item.contentDetails?.duration || '';
                        const isShort = dur.includes('S') && !dur.includes('M') && !dur.includes('H');
                        videoMetaMap.set(item.id!, {
                            title: item.snippet?.title || item.id!,
                            isShort,
                            publishedAt: item.snippet?.publishedAt ? item.snippet.publishedAt.slice(0, 10) : '',
                            duration: dur
                        });
                    }
                }
            } catch (err: any) {
                console.warn('[YOUTUBE EXPORT] Предупреждение: Не удалось загрузить названия видео из Data API:', err?.message || err);
            }
        }

        for (const row of vRows) {
            const vId = row[0];
            const meta = videoMetaMap.get(vId) || { title: `Видео ${vId}`, isShort: false, publishedAt: '', duration: '' };
            const views = row[1];
            const watchMin = row[2];
            const avgDuration = row[3];
            const avgPct = row[4];
            const subs = row[5];
            const likes = row[6];
            const comments = row[7];
            const shares = row[8];

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
                impressionsSupported ? '' : impressionsErrorMsg,
                impressionsSupported ? '' : impressionsErrorMsg
            ].map(escapeCsv).join(';'));
        }
    } catch (e: any) {
        checkFatalAuthError(e);
        console.warn('[YOUTUBE EXPORT] Предупреждение: Ошибка запроса статистики видео за 7 дней:', e?.message || e);
        csvLines.push(['-', 'Данные временно недоступны', '-', '', '', '', '', '', '', '', '', '', ''].map(escapeCsv).join(';'));
    }

    // --- 3. СТАТИСТИКА ПО КАЖДОМУ РОЛИКУ ЗА ВСЁ ВРЕМЯ ---
    csvLines.push('');
    csvLines.push(['=== 3. СТАТИСТИКА ПО КАЖДОМУ РОЛИКУ ЗА ВСЁ ВРЕМЯ (LIFETIME) ==='].map(escapeCsv).join(';'));
    csvLines.push([
        'ID видео',
        'Название видео',
        'Тип',
        'Дата публикации',
        'Просмотры (Всего)',
        'Минут просмотра (Всего)',
        'Часов просмотра (Всего)',
        'Средний % просмотра (%)',
        'Подписчики (Всего +)',
        'Ссылка на видео'
    ].map(escapeCsv).join(';'));

    try {
        const lifetimeReport = await youtubeAnalytics.reports.query({
            ids: `channel==${CHANNEL_ID}`,
            startDate: '2020-01-01',
            endDate: lastEnd,
            dimensions: 'video',
            metrics: 'views,estimatedMinutesWatched,averageViewPercentage,subscribersGained',
            sort: '-views',
            maxResults: 200
        });

        const lRows = lifetimeReport.data.rows || [];
        const lVideoIds = lRows.map(r => r[0]);

        // Подгружаем метаданные для всех роликов за всё время
        const missingLifetimeIds = lVideoIds.filter(id => !videoMetaMap.has(id));
        if (missingLifetimeIds.length > 0) {
            try {
                for (let i = 0; i < missingLifetimeIds.length; i += 50) {
                    const chunk = missingLifetimeIds.slice(i, i + 50);
                    const metaRes = await youtubeData.videos.list({
                        id: chunk,
                        part: ['snippet', 'contentDetails']
                    });
                    for (const item of metaRes.data.items || []) {
                        const dur = item.contentDetails?.duration || '';
                        const isShort = dur.includes('S') && !dur.includes('M') && !dur.includes('H');
                        videoMetaMap.set(item.id!, {
                            title: item.snippet?.title || item.id!,
                            isShort,
                            publishedAt: item.snippet?.publishedAt ? item.snippet.publishedAt.slice(0, 10) : '',
                            duration: dur
                        });
                    }
                }
            } catch (err: any) {
                console.warn('[YOUTUBE EXPORT] Предупреждение: Не удалось загрузить метаданные роликов за всё время:', err?.message || err);
            }
        }

        for (const row of lRows) {
            const vId = row[0];
            const meta = videoMetaMap.get(vId) || { title: `Видео ${vId}`, isShort: false, publishedAt: '', duration: '' };
            const views = row[1];
            const watchMin = Number(row[2]) || 0;
            const watchHours = (watchMin / 60).toFixed(1);
            const avgPct = row[3];
            const subs = row[4];
            const videoUrl = meta.isShort ? `https://youtube.com/shorts/${vId}` : `https://youtu.be/${vId}`;

            csvLines.push([
                vId,
                meta.title,
                meta.isShort ? 'Shorts' : 'Video',
                meta.publishedAt || '',
                views,
                watchMin,
                watchHours,
                avgPct !== null && avgPct !== undefined ? `${Number(avgPct).toFixed(1)}%` : '',
                subs,
                videoUrl
            ].map(escapeCsv).join(';'));
        }
    } catch (e: any) {
        checkFatalAuthError(e);
        console.warn('[YOUTUBE EXPORT] Предупреждение: Ошибка запроса статистики видео за всё время:', e?.message || e);
        csvLines.push(['-', 'Данные недоступны', '', '', '', '', '', '', '', ''].map(escapeCsv).join(';'));
    }

    // --- 4. ИСТОЧНИКИ ТРАФИКА ЗА 7 ДНЕЙ ---
    csvLines.push('');
    csvLines.push(['=== 4. ИСТОЧНИКИ ТРАФИКА ЗА ПОСЛЕДНИЕ 7 ДНЕЙ ==='].map(escapeCsv).join(';'));
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

        // Ensure we fetched at least some valid metrics before saving
    if (channelTotalSubs === 0 && (!videoMetaMap || videoMetaMap.size === 0) && csvLines.length <= 15) {
        throw new Error('YouTube API: failed to fetch channel or video metrics, aborting CSV generation');
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
            console.error('[YOUTUBE EXPORT] [ERROR]:', err?.message || err);
            process.exit(1);
        });
}

export { exportYouTubeMetrics };
