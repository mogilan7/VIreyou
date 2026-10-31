/**
 * Еженедельная выгрузка метрик открытого Telegram-канала @VI_Beautylife
 * Парсит публичный веб-интерфейс https://t.me/s/VI_Beautylife:
 * 1. Число подписчиков и сводка канала
 * 2. Публикации за последние 14 дней (номер поста, дата, первые 80 символов, просмотры, тип)
 * 
 * Сохраняет CSV с UTF-8 BOM:
 * - Локально: scripts/exports/telegram_YYYY-MM-DD.csv
 * - Google Drive: ~/Library/CloudStorage/GoogleDrive-mogilev.andrey@gmail.com/Мой диск/VIReyou/VIReyou_Аналитика/
 */

import * as fs from 'fs';
import * as path from 'path';

const CHANNEL_USERNAME = 'VI_Beautylife';

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

interface TelegramPost {
    postId: string;
    isoDate: string;
    dateFormatted: string;
    type: string;
    views: string;
    preview: string;
    url: string;
    timestamp: number;
}

async function fetchChannelHtml(url: string): Promise<string> {
    const res = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7'
        }
    });
    if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText} при обращении к ${url}`);
    }
    return await res.text();
}

function parsePostBlock(block: string): TelegramPost | null {
    const postMatch = block.match(/data-post="[^\/]+\/([0-9]+)"/i);
    if (!postMatch) return null;
    const postId = postMatch[1];

    const timeMatch = block.match(/<time datetime="([^"]+)"/i);
    if (!timeMatch) return null;
    const isoDate = timeMatch[1];
    const postDate = new Date(isoDate);
    const timestamp = postDate.getTime();
    if (isNaN(timestamp)) return null;

    // Date formatted as YYYY-MM-DD HH:mm
    const dateFormatted = isoDate.replace('T', ' ').replace(/\+.*$/, '').slice(0, 16);

    // Determine post type
    let type = 'Текст';
    if (block.includes('tgme_widget_message_roundvideo')) {
        type = 'Видео (кружочек)';
    } else if (block.includes('tgme_widget_message_video')) {
        type = 'Видео';
    } else if (block.includes('tgme_widget_message_photo_wrap') || block.includes('tgme_widget_message_photo')) {
        type = 'Фото';
    } else if (block.includes('tgme_widget_message_document')) {
        type = 'Файл';
    } else if (block.includes('tgme_widget_message_voice')) {
        type = 'Голосовое';
    }

    // Views
    const viewsMatch = block.match(/<span class="tgme_widget_message_views">([^<]+)<\/span>/i);
    const views = viewsMatch ? viewsMatch[1].trim() : '0';

    // Text / Caption preview (first 80 chars)
    let text = '';
    const textMatch = block.match(/<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    if (textMatch) {
        text = textMatch[1]
            .replace(/<tg-emoji[^>]*>[\s\S]*?<\/tg-emoji>/gi, ' ')
            .replace(/<[^>]+>/g, ' ')
            .replace(/&quot;/g, '"')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&nbsp;/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    } else {
        // Check document title or fallback
        const docMatch = block.match(/class="tgme_widget_message_document_title[^"]*"[^>]*>([^<]+)<\/div>/i);
        if (docMatch) {
            text = `[Файл] ${docMatch[1].trim()}`;
        } else if (type !== 'Текст') {
            text = `[${type} без текста]`;
        }
    }

    const preview = text.slice(0, 80);
    const url = `https://t.me/${CHANNEL_USERNAME}/${postId}`;

    return {
        postId,
        isoDate,
        dateFormatted,
        type,
        views,
        preview,
        url,
        timestamp
    };
}

async function exportTelegramChannel() {
    console.log(`[TELEGRAM EXPORT] Запуск сбора статистики канала @${CHANNEL_USERNAME}...`);

    const channelUrl = `https://t.me/s/${CHANNEL_USERNAME}`;
    let html = '';
    try {
        html = await fetchChannelHtml(channelUrl);
    } catch (e: any) {
        console.error(`[TELEGRAM EXPORT] Не удалось загрузить ${channelUrl}:`, e?.message || e);
        return null;
    }

    // 1. Извлечение подписчиков
    let subscribers = '';
    const subMatch = html.match(/class="tgme_header_counter"[^>]*>([^<]+)<\/div>/i) 
        || html.match(/([0-9\s\.,KkMm]+)\s+subscribers/i);
    if (subMatch) {
        subscribers = subMatch[1].replace(/subscribers/i, '').trim();
    }

    // 2. Извлечение названия канала
    let channelTitle = `"VI" Пространство для себя • Anti-age 🌱`;
    const titleMatch = html.match(/<div class="tgme_header_title"[^>]*>([\s\S]*?)<\/div>/i);
    if (titleMatch) {
        channelTitle = titleMatch[1].replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').trim();
    }

    // 3. Парсинг сообщений
    const messageBlocks = html.split(/<div class="tgme_widget_message[ "]/);
    const allPosts: TelegramPost[] = [];

    for (let i = 1; i < messageBlocks.length; i++) {
        const post = parsePostBlock(messageBlocks[i]);
        if (post) {
            allPosts.push(post);
        }
    }

    // Фильтр за последние 14 дней (14 * 24 * 3600 * 1000)
    const fourteenDaysAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
    const recentPosts = allPosts.filter(p => p.timestamp >= fourteenDaysAgo);

    // Сортировка от новых к старым
    recentPosts.sort((a, b) => Number(b.postId) - Number(a.postId));

    console.log(`[TELEGRAM EXPORT] Канал: "${channelTitle}", Подписчиков: ${subscribers || 'н/д'}`);
    console.log(`[TELEGRAM EXPORT] Найдено публикаций за последние 14 дней: ${recentPosts.length}`);

    // Формирование CSV
    const csvLines: string[] = [];

    // --- 1. ИТОГИ ПО КАНАЛУ ---
    csvLines.push([`=== 1. ИТОГИ ПО TELEGRAM-КАНАЛУ (@${CHANNEL_USERNAME}) ===`].map(escapeCsv).join(';'));
    csvLines.push(['Метрика', 'Значение', 'Примечание'].map(escapeCsv).join(';'));
    csvLines.push(['Название канала', channelTitle, ''].map(escapeCsv).join(';'));
    csvLines.push(['Ссылка на канал', `https://t.me/${CHANNEL_USERNAME}`, ''].map(escapeCsv).join(';'));
    csvLines.push(['Число подписчиков (Subscribers)', subscribers || 'Недоступно', 'Всего на текущий момент'].map(escapeCsv).join(';'));
    csvLines.push(['Публикаций за последние 14 дней', recentPosts.length, 'Постов за период'].map(escapeCsv).join(';'));

    // Подсчет просмотров за 14 дней
    const parseViewsNum = (vStr: string): number => {
        const s = vStr.trim().toUpperCase();
        if (s.endsWith('K')) return Math.round(parseFloat(s.replace('K', '')) * 1000);
        if (s.endsWith('M')) return Math.round(parseFloat(s.replace('M', '')) * 1000000);
        return parseInt(s.replace(/\s+/g, ''), 10) || 0;
    };

    const totalViews = recentPosts.reduce((sum, p) => sum + parseViewsNum(p.views), 0);
    const avgViews = recentPosts.length > 0 ? Math.round(totalViews / recentPosts.length) : 0;

    csvLines.push(['Суммарно просмотров (14 дней)', totalViews, 'Сумма просмотров постов за 14 дней'].map(escapeCsv).join(';'));
    csvLines.push(['Среднее число просмотров на пост', avgViews, 'В среднем за 14 дней'].map(escapeCsv).join(';'));

    // --- 2. ПУБЛИКАЦИИ ЗА ПОСЛЕДНИЕ 14 ДНЕЙ ---
    csvLines.push('');
    csvLines.push(['=== 2. ПУБЛИКАЦИИ ЗА ПОСЛЕДНИЕ 14 ДНЕЙ ==='].map(escapeCsv).join(';'));
    csvLines.push([
        'Номер поста (ID)',
        'Дата публикации',
        'Тип',
        'Просмотры',
        'Текст (первые 80 символов)',
        'Ссылка на пост'
    ].map(escapeCsv).join(';'));

    if (recentPosts.length === 0) {
        csvLines.push(['-', 'За последние 14 дней постов не публиковалось', '-', '-', '-', '-'].map(escapeCsv).join(';'));
    } else {
        for (const p of recentPosts) {
            csvLines.push([
                p.postId,
                p.dateFormatted,
                p.type,
                p.views,
                p.preview,
                p.url
            ].map(escapeCsv).join(';'));
        }
    }

    // Сохранение CSV
    const csvContent = '\uFEFF' + csvLines.join('\r\n');
    const dateStr = getFormattedDate(0);
    const fileName = `telegram_${dateStr}.csv`;

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
        console.log(`[TELEGRAM EXPORT] Сохранено на Google Drive: ${gdriveFile}`);
    }

    console.log(`[TELEGRAM EXPORT] Успешно завершено: ${fileName}`);
    return { fileName, savedPaths, csvContent };
}

if (require.main === module) {
    exportTelegramChannel()
        .then(() => process.exit(0))
        .catch(err => {
            console.error('[TELEGRAM EXPORT] Ошибка:', err);
            process.exit(1);
        });
}

export { exportTelegramChannel };
