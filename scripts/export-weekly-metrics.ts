import dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: '.env.local', override: true });
import prisma from '../src/lib/prisma';
import fs from 'fs';
import path from 'path';

function getFormattedDate(d = new Date()) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

async function exportWeeklyMetrics() {
    console.log('[METRICS EXPORT] Starting weekly funnel export...');

    // Read metrics from Supabase view
    const rows: any[] = await prisma.$queryRaw`SELECT * FROM public.weekly_funnel;`;

    if (!rows || rows.length < 2) {
        throw new Error('Expected 2 rows from weekly_funnel view (last_7_days and previous_7_days)');
    }

    const last = rows.find(r => r.period === 'last_7_days') || rows[0];
    const prev = rows.find(r => r.period === 'previous_7_days') || rows[1];

    const formatDateStr = (d: any) => {
        if (!d) return '';
        const dt = new Date(d);
        return dt.toISOString().split('T')[0];
    };

    const lastRange = `${formatDateStr(last.period_start)} .. ${formatDateStr(last.period_end)}`;
    const prevRange = `${formatDateStr(prev.period_start)} .. ${formatDateStr(prev.period_end)}`;

    const calcChange = (curr: number, prior: number) => {
        const diff = curr - prior;
        if (prior === 0) return diff > 0 ? `+${diff} (новый рост)` : '0';
        const pct = Math.round((diff / prior) * 100);
        return `${diff >= 0 ? '+' : ''}${diff} (${pct >= 0 ? '+' : ''}${pct}%)`;
    };

    const calcPct = (num: number, denom: number) => {
        if (!denom || denom === 0) return '0%';
        return `${Math.round((num / denom) * 100)}%`;
    };

    // Prepare funnel items
    const funnelMetrics = [
        {
            category: '1. Регистрации в боте',
            metric: 'Новые регистрации в Telegram-боте (всего)',
            last: Number(last.bot_reg_total),
            prev: Number(prev.bot_reg_total),
            change: calcChange(Number(last.bot_reg_total), Number(prev.bot_reg_total)),
            status: 'Активно',
            note: 'Пользователи с заполненным telegram_id'
        },
        {
            category: '1. Регистрации в боте',
            metric: '— С реферальным источником (ref / squad)',
            last: Number(last.bot_reg_with_referrer),
            prev: Number(prev.bot_reg_with_referrer),
            change: calcChange(Number(last.bot_reg_with_referrer), Number(prev.bot_reg_with_referrer)),
            status: 'Активно',
            note: 'Пришли по реф-ссылке или приглашению в марафон'
        },
        {
            category: '1. Регистрации в боте',
            metric: '— Прямые / органика (без реферера)',
            last: Number(last.bot_reg_organic),
            prev: Number(prev.bot_reg_organic),
            change: calcChange(Number(last.bot_reg_organic), Number(prev.bot_reg_organic)),
            status: 'Активно',
            note: 'Прямой поиск или ссылка без start-параметра'
        },
        {
            category: '1. Регистрации в боте',
            metric: '— Источник / start-параметры рекламных кампаний',
            last: 'N/A',
            prev: 'N/A',
            change: 'N/A',
            status: 'НЕ ЛОГИРУЕТСЯ В БД',
            note: 'Произвольные utm/start-параметры не сохраняются в User'
        },

        {
            category: '2. Прохождения тестов',
            metric: 'Всего прохождений тестов на портале',
            last: Number(last.tests_completed_total),
            prev: Number(prev.tests_completed_total),
            change: calcChange(Number(last.tests_completed_total), Number(prev.tests_completed_total)),
            status: 'Активно',
            note: 'Суммарно все тесты из test_results'
        },
        {
            category: '2. Прохождения тестов',
            metric: 'Уникальных пользователей, прошедших тесты',
            last: Number(last.tests_unique_users),
            prev: Number(prev.tests_unique_users),
            change: calcChange(Number(last.tests_unique_users), Number(prev.tests_unique_users)),
            status: 'Активно',
            note: 'Уникальные user_id в test_results'
        },
        {
            category: '2. Прохождения тестов',
            metric: 'Из них зарегистрированы в Telegram-боте',
            last: Number(last.tests_unique_users_in_bot),
            prev: Number(prev.tests_unique_users_in_bot),
            change: calcChange(Number(last.tests_unique_users_in_bot), Number(prev.tests_unique_users_in_bot)),
            status: 'Активно',
            note: `Конверсия тест -> бот: ${calcPct(Number(last.tests_unique_users_in_bot), Number(last.tests_unique_users))}`
        },

        {
            category: '2.1. Детализация тестов',
            metric: 'Системный Био-возраст (systemic-bio-age) [всего / в боте]',
            last: `${last.test_systemic_bio_age} / ${last.test_systemic_bio_age_in_bot}`,
            prev: `${prev.test_systemic_bio_age} / ${prev.test_systemic_bio_age_in_bot}`,
            change: calcChange(Number(last.test_systemic_bio_age), Number(prev.test_systemic_bio_age)),
            status: 'Активно',
            note: 'Маркеры крови и системный био-возраст'
        },
        {
            category: '2.1. Детализация тестов',
            metric: 'Функциональный резерв (functional-reserve) [всего / в боте]',
            last: `${last.test_functional_reserve} / ${last.test_functional_reserve_in_bot}`,
            prev: `${prev.test_functional_reserve} / ${prev.test_functional_reserve_in_bot}`,
            change: calcChange(Number(last.test_functional_reserve), Number(prev.test_functional_reserve)),
            status: 'Активно',
            note: 'Физические и когнитивные тесты долголетия'
        },
        {
            category: '2.1. Детализация тестов',
            metric: 'Энергия и КБЖУ (energy) [всего / в боте]',
            last: `${last.test_energy} / ${last.test_energy_in_bot}`,
            prev: `${prev.test_energy} / ${prev.test_energy_in_bot}`,
            change: calcChange(Number(last.test_energy), Number(prev.test_energy)),
            status: 'Активно',
            note: 'Калькулятор нормы калорий и макронутриентов'
        },
        {
            category: '2.1. Детализация тестов',
            metric: 'Циркадные ритмы / Хронотип (circadian) [всего / в боте]',
            last: `${last.test_circadian} / ${last.test_circadian_in_bot}`,
            prev: `${prev.test_circadian} / ${prev.test_circadian_in_bot}`,
            change: calcChange(Number(last.test_circadian), Number(prev.test_circadian)),
            status: 'Активно',
            note: 'Хронотип и циркадный профиль'
        },
        {
            category: '2.1. Детализация тестов',
            metric: 'Опросник бессонницы (insomnia) [всего / в боте]',
            last: `${last.test_insomnia} / ${last.test_insomnia_in_bot}`,
            prev: `${prev.test_insomnia} / ${prev.test_insomnia_in_bot}`,
            change: calcChange(Number(last.test_insomnia), Number(prev.test_insomnia)),
            status: 'Активно',
            note: 'Индекс тяжести инсомнии (ISI)'
        },
        {
            category: '2.1. Детализация тестов',
            metric: 'Саркопения (sarc-f) [всего / в боте]',
            last: `${last.test_sarc_f} / ${last.test_sarc_f_in_bot}`,
            prev: `${prev.test_sarc_f} / ${prev.test_sarc_f_in_bot}`,
            change: calcChange(Number(last.test_sarc_f), Number(prev.test_sarc_f)),
            status: 'Активно',
            note: 'Скрининг мышечной силы и массы SARC-F'
        },

        {
            category: '3. Активация',
            metric: 'Активация: залогировали еду в первые 24 часа (чел)',
            last: Number(last.activated_users_24h),
            prev: Number(prev.activated_users_24h),
            change: calcChange(Number(last.activated_users_24h), Number(prev.activated_users_24h)),
            status: 'Активно',
            note: 'Первая запись NutritionLog в течение 24ч от регистрации'
        },
        {
            category: '3. Активация',
            metric: 'Конверсия в активацию первых 24ч (%)',
            last: calcPct(Number(last.activated_users_24h), Number(last.bot_reg_total)),
            prev: calcPct(Number(prev.activated_users_24h), Number(prev.bot_reg_total)),
            change: '-',
            status: 'Активно',
            note: 'activated_users_24h / bot_reg_total'
        },

        {
            category: '4. Удержание (Retention)',
            metric: 'Размер когорты (зарег. 7-14 дней назад)',
            last: Number(last.d7_cohort_size),
            prev: Number(prev.d7_cohort_size),
            change: calcChange(Number(last.d7_cohort_size), Number(prev.d7_cohort_size)),
            status: 'Активно',
            note: 'База для расчета Retention на 7-й день'
        },
        {
            category: '4. Удержание (Retention)',
            metric: 'Активные на 7-й день (D7 Active Users)',
            last: Number(last.d7_active_users),
            prev: Number(prev.d7_active_users),
            change: calcChange(Number(last.d7_active_users), Number(prev.d7_active_users)),
            status: 'Активно',
            note: 'Лог еды, сна, шагов, воды или теста на 7-й день и позже'
        },
        {
            category: '4. Удержание (Retention)',
            metric: 'Retention 7-го дня (D7 %)',
            last: calcPct(Number(last.d7_active_users), Number(last.d7_cohort_size)),
            prev: calcPct(Number(prev.d7_active_users), Number(prev.d7_cohort_size)),
            change: '-',
            status: 'Активно',
            note: 'd7_active_users / d7_cohort_size'
        },

        {
            category: '5. Монетизация и Пейвол',
            metric: 'Пользователи, видевшие пейвол или предложение оплаты',
            last: 'N/A',
            prev: 'N/A',
            change: 'N/A',
            status: 'НЕ ЛОГИРУЕТСЯ В БД',
            note: 'Показы экрана подписки в боте/вебе не пишутся в БД'
        },
        {
            category: '5. Монетизация и Пейвол',
            metric: 'Нажатия «Оплатить» (попытки платежа)',
            last: Number(last.checkout_clicks_pending),
            prev: Number(prev.checkout_clicks_pending),
            change: calcChange(Number(last.checkout_clicks_pending), Number(prev.checkout_clicks_pending)),
            status: 'Частично',
            note: 'Считает созданные pending-заказы в Transaction'
        },
        {
            category: '5. Монетизация и Пейвол',
            metric: 'Успешные оплаты (кол-во транзакций)',
            last: Number(last.successful_payments_count),
            prev: Number(prev.successful_payments_count),
            change: calcChange(Number(last.successful_payments_count), Number(prev.successful_payments_count)),
            status: 'Активно',
            note: 'Типы транзакций SUBSCRIPTION и TELEGRAM_STARS'
        },
        {
            category: '5. Монетизация и Пейвол',
            metric: 'Сумма успешных оплат (₽ / эквивалент)',
            last: `${Number(last.successful_payments_sum).toFixed(2)} ₽`,
            prev: `${Number(prev.successful_payments_sum).toFixed(2)} ₽`,
            change: calcChange(Number(last.successful_payments_sum), Number(prev.successful_payments_sum)),
            status: 'Активно',
            note: 'Фактическая выручка за период'
        },

        {
            category: '6. Маркетинг и Трафик',
            metric: 'Клики по UTM-ссылкам на портале',
            last: 'N/A',
            prev: 'N/A',
            change: 'N/A',
            status: 'НЕ ЛОГИРУЕТСЯ В БД',
            note: 'UTM-метки не парсятся и не сохраняются в БД портала'
        }
    ];

    // Build CSV content
    const csvHeader = [
        'Категория',
        'Метрика',
        `Последние 7 дней (${lastRange})`,
        `Предыдущие 7 дней (${prevRange})`,
        'Динамика',
        'Статус в БД',
        'Примечание'
    ];

    const escapeCsv = (val: any) => {
        const s = String(val ?? '');
        if (s.includes(';') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
            return '"' + s.split('"').join('""') + '"';
        }
        return s;
    };

    const csvLines = [
        csvHeader.map(escapeCsv).join(';')
    ];

    for (const item of funnelMetrics) {
        csvLines.push([
            item.category,
            item.metric,
            item.last,
            item.prev,
            item.change,
            item.status,
            item.note
        ].map(escapeCsv).join(';'));
    }

    const csvContent = '\uFEFF' + csvLines.join('\r\n'); // UTF-8 BOM for Excel

    const dateStr = getFormattedDate();
    const fileName = `vireyou_funnel_${dateStr}.csv`;

    // Locate Google Drive folder
    const gdriveDir = '/Users/mogilevandrei/Library/CloudStorage/GoogleDrive-mogilev.andrey@gmail.com/Мой диск/VIReyou/VIReyou_Аналитика';
    const localDir = path.resolve(__dirname, 'exports');

    let savedPaths: string[] = [];

    // Save to local exports backup
    if (!fs.existsSync(localDir)) {
        fs.mkdirSync(localDir, { recursive: true });
    }
    const localFilePath = path.join(localDir, fileName);
    fs.writeFileSync(localFilePath, csvContent, 'utf8');
    savedPaths.push(localFilePath);

    // Save to Google Drive if folder exists
    if (fs.existsSync(gdriveDir)) {
        const gdriveFilePath = path.join(gdriveDir, fileName);
        fs.writeFileSync(gdriveFilePath, csvContent, 'utf8');
        savedPaths.push(gdriveFilePath);
        console.log(`[METRICS EXPORT] Successfully saved to Google Drive: ${gdriveFilePath}`);
    } else {
        console.warn(`[METRICS EXPORT] Google Drive path not found: ${gdriveDir}`);
    }

    console.log(`[METRICS EXPORT] Export completed successfully: ${fileName}`);
    console.log('[METRICS EXPORT] File saved to:', savedPaths.join(', '));

    return {
        fileName,
        savedPaths,
        csvContent
    };
}

if (require.main === module) {
    exportWeeklyMetrics()
        .then(() => process.exit(0))
        .catch(err => {
            console.error('[METRICS EXPORT] Fatal error:', err);
            process.exit(1);
        });
}

export { exportWeeklyMetrics };
