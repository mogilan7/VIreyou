import prisma from '@/lib/prisma';
import crypto from 'crypto';

export interface TelegramUserData {
    id: string | number;
    username?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    language_code?: string | null;
}

export function detectTimezoneFromLang(languageCode?: string | null): string {
    const map: Record<string, string> = {
        'ru': 'Europe/Moscow',
        'uk': 'Europe/Kiev',
        'be': 'Europe/Minsk',
        'kk': 'Asia/Almaty',
        'uz': 'Asia/Tashkent',
        'en': 'UTC'
    };
    return (languageCode && map[languageCode]) || 'Europe/Moscow';
}

export async function findOrCreateTelegramUser(
    tgUser: TelegramUserData,
    opts: {
        source?: string;
        referrer_id?: string | null;
        utm_source?: string | null;
        utm_campaign?: string | null;
        start_param?: string | null;
    } = {}
) {
    const tgIdStr = String(tgUser.id);
    const autoEmail = `tg_${tgIdStr}@vireyou.com`;

    let user = await prisma.user.findFirst({
        where: {
            OR: [
                { telegram_id: tgIdStr },
                { email: autoEmail }
            ]
        }
    });

    if (!user) {
        const userLang = detectTimezoneFromLang(tgUser.language_code) === 'Europe/Moscow' ? 'ru' : 'en';
        const userTz = detectTimezoneFromLang(tgUser.language_code);
        const source = opts.source || 'miniapp';

        user = await prisma.user.create({
            data: {
                id: crypto.randomUUID(),
                email: autoEmail,
                telegram_id: tgIdStr,
                telegram_username: tgUser.username || null,
                role: 'client',
                full_name: tgUser.first_name || 'Спортсмен',
                language: userLang,
                timezone: userTz,
                referrer_id: opts.referrer_id && opts.referrer_id !== tgIdStr ? opts.referrer_id : null,
                subscription_expires_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days free trial
                start_param: opts.start_param || null,
                utm_source: opts.utm_source || null,
                utm_campaign: opts.utm_campaign || null
            }
        });

        // Log bot_signup event
        try {
            await prisma.analyticsEvent.create({
                data: {
                    event: 'bot_signup',
                    user_id: user.id,
                    session_id: `tg_${tgIdStr}`,
                    source: source,
                    utm_source: opts.utm_source || null,
                    utm_campaign: opts.utm_campaign || null,
                    meta: {
                        tg_id: tgIdStr,
                        username: tgUser.username || null,
                        first_name: tgUser.first_name || null,
                        language_code: tgUser.language_code || null,
                        source: source
                    }
                }
            });
        } catch (e) {
            console.warn('[ANALYTICS] Failed to log bot_signup event:', e);
        }
    } else {
        // Ensure telegram_id is set if it was previously empty
        if (!user.telegram_id) {
            user = await prisma.user.update({
                where: { id: user.id },
                data: { telegram_id: tgIdStr }
            });
        }
        // Update username if changed
        if (tgUser.username && user.telegram_username !== tgUser.username) {
            user = await prisma.user.update({
                where: { id: user.id },
                data: { telegram_username: tgUser.username }
            });
        }
    }

    return user;
}
