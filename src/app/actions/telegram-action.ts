'use server';

export async function linkTelegramAction(telegramId: string, telegramUsername?: string, timezone?: string) {
    // SECURITY: Disabled until cryptographic signature verification (HMAC-SHA256 with bot token) is implemented
    throw new Error('linkTelegramAction is temporarily disabled for security review: requires cryptographic validation of Telegram initData/widget hash.');
}
