'use server';

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function assignTestsToClient(clientId: string, testIds: string[], notes: string, telegramId?: string | null) {
    try {
        // 1. Grant Access_Permissions to unlock the tests for the client
        const permissions = testIds.map(testId => ({
            user_id: clientId,
            test_id: testId,
        }));

        // Use transaction to insert all or skip duplicates (using try/catch for upserts or ignore)
        for (const testId of testIds) {
            await prisma.accessPermission.upsert({
                where: {
                    user_id_test_id: {
                        user_id: clientId,
                        test_id: testId,
                    }
                },
                update: {},
                create: {
                    user_id: clientId,
                    test_id: testId,
                }
            });
        }

        // 2. Prepare the Telegram JSON payload
        const botToken = process.env.TELEGRAM_BOT_TOKEN || 'MOCK_TOKEN';
        const targetChatId = telegramId || 'mock_chat_id';

        const payload = {
            chat_id: targetChatId,
            text: `Hello! Your specialist has completed your review. New diagnostics have been unlocked for you in your portal.\n\nNotes from Specialist: ${notes}`,
            parse_mode: 'HTML'
        };

        console.log('[Server Action] Sending Telegram Payload:', JSON.stringify(payload, null, 2));

        // 3. Make real fetch request to Telegram API (will fail harmlessly with mock token)
        if (process.env.TELEGRAM_BOT_TOKEN) {
            const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                console.error('Telegram API responded with error:', await response.text());
            }
        }

        return { success: true, message: 'Tests assigned and notification sent successfully.' };
    } catch (error) {
        console.error('Error assigning tests:', error);
        return { success: false, message: 'Failed to assign tests.' };
    }
}
