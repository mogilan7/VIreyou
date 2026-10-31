import prisma from '@/lib/prisma';
import crypto from 'crypto';
import { mergeUserAccounts } from '@/lib/auth/mergeUsers';

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

/**
 * Deterministic account sorter:
 * 1. Real email (not starting with 'tg_') comes before placeholder 'tg_*'
 * 2. If tie, earlier created_at comes first
 */
export function sortTelegramAccounts(
    a: { email: string; created_at?: Date | string | null },
    b: { email: string; created_at?: Date | string | null }
): number {
    const aIsTg = a.email.startsWith('tg_');
    const bIsTg = b.email.startsWith('tg_');
    if (aIsTg !== bIsTg) {
        return aIsTg ? 1 : -1; // real email (-1) comes before tg_* (+1)
    }
    const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
    const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
    return aTime - bTime; // earlier created_at first
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

    // 1. Find all matching accounts for this telegram_id or autoEmail
    const matchingUsers = await prisma.user.findMany({
        where: {
            OR: [
                { telegram_id: tgIdStr },
                { email: autoEmail }
            ]
        }
    });

    let user: any = null;

    if (matchingUsers.length > 1) {
        const realAccounts = matchingUsers.filter(u => !u.email.startsWith('tg_'));
        const placeholderAccounts = matchingUsers.filter(u => u.email.startsWith('tg_'));

        if (realAccounts.length >= 2) {
            console.warn(`[AUTH][ALERT] multiple real accounts for telegram_id ${tgIdStr}`);
            realAccounts.sort(sortTelegramAccounts);
            user = realAccounts[0];
        } else if (realAccounts.length === 1 && placeholderAccounts.length > 0) {
            const targetUser = realAccounts[0];
            for (const placeholder of placeholderAccounts) {
                console.log(`[AUTH] Auto-merging placeholder ${placeholder.id} into target ${targetUser.id}`);
                try {
                    await prisma.$transaction(async (tx) => {
                        await mergeUserAccounts(tx, targetUser.id, placeholder.id);
                    }, {
                        maxWait: 20000,
                        timeout: 60000
                    });
                } catch (mergeErr: any) {
                    console.error(`[AUTH] Auto-merge failed for placeholder ${placeholder.id}:`, mergeErr?.message);
                }
            }
            user = await prisma.user.findUnique({ where: { id: targetUser.id } });
        } else if (realAccounts.length === 0 && placeholderAccounts.length > 1) {
            placeholderAccounts.sort(sortTelegramAccounts);
            const targetUser = placeholderAccounts[0];
            const extraPlaceholders = placeholderAccounts.slice(1);
            for (const placeholder of extraPlaceholders) {
                console.log(`[AUTH] Auto-merging placeholder ${placeholder.id} into target ${targetUser.id}`);
                try {
                    await prisma.$transaction(async (tx) => {
                        await mergeUserAccounts(tx, targetUser.id, placeholder.id);
                    }, {
                        maxWait: 20000,
                        timeout: 60000
                    });
                } catch (mergeErr: any) {
                    console.error(`[AUTH] Auto-merge failed for placeholder ${placeholder.id}:`, mergeErr?.message);
                }
            }
            user = await prisma.user.findUnique({ where: { id: targetUser.id } });
        } else {
            matchingUsers.sort(sortTelegramAccounts);
            user = matchingUsers[0];
        }
    } else if (matchingUsers.length === 1) {
        user = matchingUsers[0];
    }

    if (!user) {
        const userLang = detectTimezoneFromLang(tgUser.language_code) === 'Europe/Moscow' ? 'ru' : 'en';
        const userTz = detectTimezoneFromLang(tgUser.language_code);
        const source = opts.source || 'miniapp';

        try {
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
        } catch (createErr: any) {
            // Prisma P2002: unique constraint failed -> retry lookup
            if (createErr?.code === 'P2002' || (createErr?.message && createErr.message.includes('P2002'))) {
                console.warn(`[AUTH] User creation hit P2002 for telegram_id ${tgIdStr}, falling back to lookup`);
                const existing = await prisma.user.findMany({
                    where: {
                        OR: [
                            { telegram_id: tgIdStr },
                            { email: autoEmail }
                        ]
                    }
                });
                if (existing.length > 0) {
                    existing.sort(sortTelegramAccounts);
                    user = existing[0];
                } else {
                    throw createErr;
                }
            } else {
                throw createErr;
            }
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
