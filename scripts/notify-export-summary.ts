import dotenv from 'dotenv';
import path from 'path';

// Load .env.local then .env
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const botToken = process.env.TELEGRAM_BOT_TOKEN;
const TARGET_CHAT_ID = '175269194';

async function sendNotification() {
    if (!botToken) {
        console.warn('[NOTIFY] TELEGRAM_BOT_TOKEN is not set, skipping notification');
        return;
    }

    // Parse CLI arguments:
    // --funnel <0|1> <error> --youtube <0|1> <error> --instagram <0|1> <error> --telegram <0|1> <error>
    const args = process.argv.slice(2);
    
    function parseArg(key: string): { ok: boolean; error: string } {
        const idx = args.indexOf(`--${key}`);
        if (idx === -1) return { ok: true, error: '' };
        const code = args[idx + 1] || '0';
        const errorMsg = (args[idx + 2] && !args[idx + 2].startsWith('--')) ? args[idx + 2].trim() : '';
        return {
            ok: code === '0',
            error: errorMsg
        };
    }

    const funnel = parseArg('funnel');
    const youtube = parseArg('youtube');
    const instagram = parseArg('instagram');
    const telegram = parseArg('telegram');

    const formatPart = (name: string, item: { ok: boolean; error: string }) => {
        if (item.ok) {
            return `${name} ✅`;
        }
        const cleanErr = (item.error || 'ошибка')
            .replace(/[<>{}\[\]\n\r\t]/g, ' ')
            .replace(/https?:\/\/[^\s]+/g, '')
            .replace(/access_token[=:][^\s&]+/gi, '')
            .replace(/token[=:][^\s&]+/gi, '')
            .trim()
            .slice(0, 50);
        return `${name} ❌ ${cleanErr}`;
    };

    const text = `Выгрузка: ${formatPart('воронка', funnel)}, ${formatPart('YouTube', youtube)}, ${formatPart('Instagram', instagram)}, ${formatPart('Telegram', telegram)}`;

    console.log(`[NOTIFY] Sending text: "${text}" to ${TARGET_CHAT_ID}`);

    try {
        const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: TARGET_CHAT_ID,
                text: text
            })
        });
        const data = await res.json();
        if (data.ok) {
            console.log('[NOTIFY] Telegram summary delivered successfully');
        } else {
            console.warn('[NOTIFY] Telegram delivery failed:', data.description);
        }
    } catch (e: any) {
        console.warn('[NOTIFY] Network error while sending telegram summary:', e?.message || e);
    }
}

sendNotification().catch(err => {
    console.error('[NOTIFY] Unexpected error:', err?.message || err);
    process.exit(0); // do not fail export pipeline if notify fails
});
