/**
 * Конфигурация фильтрации внутреннего трафика команды.
 * Исключает администраторов, штатных сотрудников и внутренних тестировщиков из воронки.
 */

export const INTERNAL_USER_IDS: string[] = [
    'dc39e0c0-8016-4ca6-8a80-17e1950b6b6a', // Андрей (admin)
    '2fe15dcd-a2ad-416e-a7e3-efa7a81750b1', // Валентина
];

export const INTERNAL_COOKIE_NAME = 'vireyou_internal';

export function isInternalUserId(userId: string | null | undefined): boolean {
    if (!userId) return false;
    return INTERNAL_USER_IDS.includes(userId);
}

