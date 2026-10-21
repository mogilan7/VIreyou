import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });
/**
 * Еженедельная автоматическая выгрузка воронки VIReyou
 * Выгружает данные из Supabase (view public.weekly_funnel и AnalyticsEvent)
 * за последние 7 дней и предыдущие 7 дней.
 * 
 * Сохраняет CSV с UTF-8 BOM в папку Google Drive:
 * ~/Library/CloudStorage/GoogleDrive-mogilev.andrey@gmail.com/Мой диск/VIReyou/VIReyou_Аналитика/
 * а также в локальный backup scripts/exports/
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

function getFormattedDate(): string {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatDate(d: Date | string): string {
    const date = new Date(d);
    return date.toISOString().split('T')[0];
}

function calcChange(last: number, prev: number): string {
    if (prev === 0) {
        return last > 0 ? '+100%' : '0%';
    }
    const diff = ((last - prev) / prev) * 100;
    const sign = diff > 0 ? '+' : '';
    return `${sign}${diff.toFixed(1)}%`;
}

function calcPct(part: number, total: number): string {
    if (!total || total === 0) return '0.0%';
    return `${((part / total) * 100).toFixed(1)}%`;
}

interface FunnelRow {
    period: string;
    period_start: string;
    period_end: string;
    portal_visits: number;
    portal_visits_utm: number;
    bot_reg_total: number;
    bot_reg_with_referrer: number;
    bot_reg_with_start_param: number;
    bot_reg_organic: number;
    bot_start_total: number;
    bot_start_yt: number;
    event_bot_signups: number;
    tests_completed_total: number;
    tests_unique_users: number;
    tests_unique_users_in_bot: number;
    event_tests_started: number;
    event_tests_completed_all: number;
    event_tests_completed_anon: number;
    test_systemic_bio_age: number;
    test_systemic_bio_age_in_bot: number;
    test_functional_reserve: number;
    test_functional_reserve_in_bot: number;
    test_energy: number;
    test_energy_in_bot: number;
    test_circadian: number;
    test_circadian_in_bot: number;
    test_insomnia: number;
    test_insomnia_in_bot: number;
    test_sarc_f: number;
    test_sarc_f_in_bot: number;
    event_start_systemic_bio_age: number;
    event_start_functional_reserve: number;
    event_start_energy: number;
    event_start_circadian: number;
    event_start_insomnia: number;
    event_start_sarc_f: number;
    activated_users_24h: number;
    event_first_meals_logged: number;
    d7_cohort_size: number;
    d7_active_users: number;
    event_paywall_views: number;
    event_paywall_portal: number;
    event_paywall_bot: number;
    event_checkout_clicks: number;
    checkout_clicks_pending: number;
    successful_payments_count: number;
    successful_payments_sum: number;
}

interface CampaignRow {
    campaign: string;
    source: string;
    visits: number;
    test_starts: number;
    test_completes: number;
    bot_starts: number;
    checkout_clicks: number;
}

async function exportWeeklyMetrics() {
    console.log('[METRICS EXPORT] Starting weekly funnel export...');

    // 1. Query view weekly_funnel
    const rows = await prisma.$queryRaw<FunnelRow[]>`
        SELECT * FROM public.weekly_funnel;
    `;

    if (!rows || rows.length < 2) {
        throw new Error(`Expected 2 rows from weekly_funnel view, got ${rows?.length || 0}`);
    }

    const last = rows.find(r => r.period === 'last_7_days') || rows[0];
    const prev = rows.find(r => r.period === 'previous_7_days') || rows[1];

    const lastRange = `${formatDate(last.period_start)} — ${formatDate(last.period_end)}`;
    const prevRange = `${formatDate(prev.period_start)} — ${formatDate(prev.period_end)}`;

    console.log(`[METRICS EXPORT] Loaded periods: Last (${lastRange}) vs Prev (${prevRange})`);

    // 2. Query Top-5 campaigns from AnalyticsEvent
    let topCampaigns: CampaignRow[] = [];
    try {
        topCampaigns = await prisma.$queryRaw<CampaignRow[]>`
            SELECT 
                COALESCE(NULLIF(utm_campaign, ''), '(не указана)') AS campaign,
                COALESCE(NULLIF(utm_source, ''), '(не указан)') AS source,
                count(*) FILTER (WHERE event = 'portal_visit')::int AS visits,
                count(*) FILTER (WHERE event = 'test_start')::int AS test_starts,
                count(*) FILTER (WHERE event = 'test_complete')::int AS test_completes,
                count(*) FILTER (WHERE event = 'bot_start')::int AS bot_starts,
                count(*) FILTER (WHERE event = 'checkout_click')::int AS checkout_clicks
            FROM "AnalyticsEvent"
            WHERE created_at >= now() - interval '7 days'
            GROUP BY utm_campaign, utm_source
            ORDER BY visits DESC, test_starts DESC
            LIMIT 5;
        `;
    } catch (e) {
        console.warn('[METRICS EXPORT] Warning: Failed to query top campaigns:', e);
    }

    // 3. Assemble main funnel metrics
    const funnelMetrics = [
        // 0. Трафик и Визиты
        {
            category: '0. Трафик и Визиты портала',
            metric: 'Визиты портала (сессии portal_visit)',
            last: Number(last.portal_visits || 0),
            prev: Number(prev.portal_visits || 0),
            change: calcChange(Number(last.portal_visits || 0), Number(prev.portal_visits || 0)),
            status: 'Активно',
            note: 'Первый заход в уникальной сессии за период'
        },
        {
            category: '0. Трафик и Визиты портала',
            metric: 'Визиты с UTM-метками (маркетинговый трафик)',
            last: Number(last.portal_visits_utm || 0),
            prev: Number(prev.portal_visits_utm || 0),
            change: calcChange(Number(last.portal_visits_utm || 0), Number(prev.portal_visits_utm || 0)),
            status: 'Активно',
            note: 'Визиты с известным utm_source (YouTube, Reels и т.д.)'
        },
        {
            category: '0. Трафик и Визиты портала',
            metric: 'Доля размеченного UTM-трафика (%)',
            last: calcPct(Number(last.portal_visits_utm || 0), Number(last.portal_visits || 0)),
            prev: calcPct(Number(prev.portal_visits_utm || 0), Number(prev.portal_visits || 0)),
            change: '-',
            status: 'Активно',
            note: 'portal_visits_utm / portal_visits'
        },

        // 1. Привлечение и бот
        {
            category: '1. Привлечение и Бот',
            metric: 'Запуски бота (события bot_start)',
            last: Number(last.bot_start_total || 0),
            prev: Number(prev.bot_start_total || 0),
            change: calcChange(Number(last.bot_start_total || 0), Number(prev.bot_start_total || 0)),
            status: 'Активно',
            note: 'События /start бота в Telegram'
        },
        {
            category: '1. Привлечение и Бот',
            metric: 'Запуски бота из YouTube (start=yt_*)',
            last: Number(last.bot_start_yt || 0),
            prev: Number(prev.bot_start_yt || 0),
            change: calcChange(Number(last.bot_start_yt || 0), Number(prev.bot_start_yt || 0)),
            status: 'Активно',
            note: 'Переходы по ссылкам t.me/vireyou_bot?start=yt_<тема>'
        },
{
            category: '1. Привлечение и Бот',
            metric: 'Создано профилей в боте (события bot_signup)',
            last: Number(last.event_bot_signups || 0),
            prev: Number(prev.event_bot_signups || 0),
            change: calcChange(Number(last.event_bot_signups || 0), Number(prev.event_bot_signups || 0)),
            status: 'Активно',
            note: 'Момент создания Telegram-first профиля при /start'
        },
        {
            category: '1. Привлечение и Бот',
            metric: 'Новые регистрации в боте (всего)',
            last: Number(last.bot_reg_total),
            prev: Number(prev.bot_reg_total),
            change: calcChange(Number(last.bot_reg_total), Number(prev.bot_reg_total)),
            status: 'Активно',
            note: 'Пользователи с telegram_id, созданные за период'
        },
        {
            category: '1. Привлечение и Бот',
            metric: 'Регистрации с меткой start_param',
            last: Number(last.bot_reg_with_start_param || 0),
            prev: Number(prev.bot_reg_with_start_param || 0),
            change: calcChange(Number(last.bot_reg_with_start_param || 0), Number(prev.bot_reg_with_start_param || 0)),
            status: 'Активно',
            note: 'Регистрации с сохраненным start_param (YouTube, кампании)'
        },
        {
            category: '1. Привлечение и Бот',
            metric: 'Регистрации по реферальной ссылке',
            last: Number(last.bot_reg_with_referrer),
            prev: Number(prev.bot_reg_with_referrer),
            change: calcChange(Number(last.bot_reg_with_referrer), Number(prev.bot_reg_with_referrer)),
            status: 'Активно',
            note: 'Пользователи с заполненным referrer_id'
        },
        {
            category: '1. Привлечение и Бот',
            metric: 'Органические регистрации в боте',
            last: Number(last.bot_reg_organic),
            prev: Number(prev.bot_reg_organic),
            change: calcChange(Number(last.bot_reg_organic), Number(prev.bot_reg_organic)),
            status: 'Активно',
            note: 'Без реферера и без рекламного start_param'
        },

        // 2. Диагностика и Тесты (Общие)
        {
            category: '2. Диагностика и Тесты (Общие)',
            metric: 'Начатые тесты на портале (всего, с анонимами)',
            last: Number(last.event_tests_started || 0),
            prev: Number(prev.event_tests_started || 0),
            change: calcChange(Number(last.event_tests_started || 0), Number(prev.event_tests_started || 0)),
            status: 'Активно',
            note: 'События test_start из AnalyticsEvent'
        },
        {
            category: '2. Диагностика и Тесты (Общие)',
            metric: 'Завершенные тесты (всего, с анонимами)',
            last: Number(last.event_tests_completed_all || 0),
            prev: Number(prev.event_tests_completed_all || 0),
            change: calcChange(Number(last.event_tests_completed_all || 0), Number(prev.event_tests_completed_all || 0)),
            status: 'Активно',
            note: 'События test_complete из AnalyticsEvent'
        },
        {
            category: '2. Диагностика и Тесты (Общие)',
            metric: 'Завершено тестов анонимами (без входа)',
            last: Number(last.event_tests_completed_anon || 0),
            prev: Number(prev.event_tests_completed_anon || 0),
            change: calcChange(Number(last.event_tests_completed_anon || 0), Number(prev.event_tests_completed_anon || 0)),
            status: 'Активно',
            note: 'Пользователи, прошедшие тест до регистрации/входа'
        },
        {
            category: '2. Диагностика и Тесты (Общие)',
            metric: 'Конверсия прохождения тестов (Complete / Start %)',
            last: calcPct(Number(last.event_tests_completed_all || 0), Number(last.event_tests_started || 0)),
            prev: calcPct(Number(prev.event_tests_completed_all || 0), Number(prev.event_tests_started || 0)),
            change: '-',
            status: 'Активно',
            note: 'event_tests_completed_all / event_tests_started'
        },
        {
            category: '2. Диагностика и Тесты (Общие)',
            metric: 'Сохраненные тесты в профилях (test_results)',
            last: Number(last.tests_completed_total),
            prev: Number(prev.tests_completed_total),
            change: calcChange(Number(last.tests_completed_total), Number(prev.tests_completed_total)),
            status: 'Активно',
            note: 'Записи в таблице test_results авторизованных пользователей'
        },
        {
            category: '2. Диагностика и Тесты (Общие)',
            metric: 'Уникальные пользователи, сохранившие тесты',
            last: Number(last.tests_unique_users),
            prev: Number(prev.tests_unique_users),
            change: calcChange(Number(last.tests_unique_users), Number(prev.tests_unique_users)),
            status: 'Активно',
            note: 'Количество человек, сохранивших результат хотя бы 1 теста'
        },
        {
            category: '2. Диагностика и Тесты (Общие)',
            metric: 'Из них зарегистрированы в боте (чел)',
            last: Number(last.tests_unique_users_in_bot),
            prev: Number(prev.tests_unique_users_in_bot),
            change: calcChange(Number(last.tests_unique_users_in_bot), Number(prev.tests_unique_users_in_bot)),
            status: 'Активно',
            note: 'Прошли тест и имеют привязанный telegram_id'
        },

        // 2.1. Детализация тестов
        {
            category: '2.1. Детализация тестов',
            metric: 'Биовозраст систем (systemic-bio-age) [старт / сохр]',
            last: `${last.event_start_systemic_bio_age || 0} / ${last.test_systemic_bio_age}`,
            prev: `${prev.event_start_systemic_bio_age || 0} / ${prev.test_systemic_bio_age}`,
            change: calcChange(Number(last.test_systemic_bio_age), Number(prev.test_systemic_bio_age)),
            status: 'Активно',
            note: 'Старты в событиях / Сохраненные в test_results'
        },
        {
            category: '2.1. Детализация тестов',
            metric: 'Функциональный резерв (functional-reserve) [старт / сохр]',
            last: `${last.event_start_functional_reserve || 0} / ${last.test_functional_reserve}`,
            prev: `${prev.event_start_functional_reserve || 0} / ${prev.test_functional_reserve}`,
            change: calcChange(Number(last.test_functional_reserve), Number(prev.test_functional_reserve)),
            status: 'Активно',
            note: 'Старты в событиях / Сохраненные в test_results'
        },
        {
            category: '2.1. Детализация тестов',
            metric: 'Энергообмен BMR/TDEE (energy) [старт / сохр]',
            last: `${last.event_start_energy || 0} / ${last.test_energy}`,
            prev: `${prev.event_start_energy || 0} / ${prev.test_energy}`,
            change: calcChange(Number(last.test_energy), Number(prev.test_energy)),
            status: 'Активно',
            note: 'Старты в событиях / Сохраненные в test_results'
        },
        {
            category: '2.1. Детализация тестов',
            metric: 'Циркадный хронотип (circadian) [старт / сохр]',
            last: `${last.event_start_circadian || 0} / ${last.test_circadian}`,
            prev: `${prev.event_start_circadian || 0} / ${prev.test_circadian}`,
            change: calcChange(Number(last.test_circadian), Number(prev.test_circadian)),
            status: 'Активно',
            note: 'Старты в событиях / Сохраненные в test_results'
        },
        {
            category: '2.1. Детализация тестов',
            metric: 'Индекс бессонницы ISI (insomnia) [старт / сохр]',
            last: `${last.event_start_insomnia || 0} / ${last.test_insomnia}`,
            prev: `${prev.event_start_insomnia || 0} / ${prev.test_insomnia}`,
            change: calcChange(Number(last.test_insomnia), Number(prev.test_insomnia)),
            status: 'Активно',
            note: 'Старты в событиях / Сохраненные в test_results'
        },
        {
            category: '2.1. Детализация тестов',
            metric: 'Саркопения SARC-F (sarc-f) [старт / сохр]',
            last: `${last.event_start_sarc_f || 0} / ${last.test_sarc_f}`,
            prev: `${prev.event_start_sarc_f || 0} / ${prev.test_sarc_f}`,
            change: calcChange(Number(last.test_sarc_f), Number(prev.test_sarc_f)),
            status: 'Активно',
            note: 'Старты в событиях / Сохраненные в test_results'
        },

        // 3. Активация
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

        // 4. Удержание
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

        // 5. Монетизация и Пейвол
        {
            category: '5. Монетизация и Пейвол',
            metric: 'Просмотры пейвола (события paywall_view всего)',
            last: Number(last.event_paywall_views || 0),
            prev: Number(prev.event_paywall_views || 0),
            change: calcChange(Number(last.event_paywall_views || 0), Number(prev.event_paywall_views || 0)),
            status: 'Активно',
            note: 'Показы экранов тарифов на портале и меню в боте'
        },
        {
            category: '5. Монетизация и Пейвол',
            metric: 'Просмотры пейвола: портал / бот',
            last: `${last.event_paywall_portal || 0} / ${last.event_paywall_bot || 0}`,
            prev: `${prev.event_paywall_portal || 0} / ${prev.event_paywall_bot || 0}`,
            change: '-',
            status: 'Активно',
            note: 'Разбивка по источнику (portal vs telegram_bot)'
        },
        {
            category: '5. Монетизация и Пейвол',
            metric: 'Клики «Оплатить» (события checkout_click)',
            last: Number(last.event_checkout_clicks || 0),
            prev: Number(prev.event_checkout_clicks || 0),
            change: calcChange(Number(last.event_checkout_clicks || 0), Number(prev.event_checkout_clicks || 0)),
            status: 'Активно',
            note: 'Нажатия на кнопки тарифов перед переходом к оплате'
        },
        {
            category: '5. Монетизация и Пейвол',
            metric: 'Созданные заказы в БД (Transaction PENDING)',
            last: Number(last.checkout_clicks_pending),
            prev: Number(prev.checkout_clicks_pending),
            change: calcChange(Number(last.checkout_clicks_pending), Number(prev.checkout_clicks_pending)),
            status: 'Активно',
            note: 'Инициализированные платежи в платежных шлюзах'
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
            metric: 'Конверсия клика в успешную оплату (%)',
            last: calcPct(Number(last.successful_payments_count), Number(last.event_checkout_clicks || last.checkout_clicks_pending || 0)),
            prev: calcPct(Number(prev.successful_payments_count), Number(prev.event_checkout_clicks || prev.checkout_clicks_pending || 0)),
            change: '-',
            status: 'Активно',
            note: 'successful_payments / checkout_clicks'
        },
        {
            category: '5. Монетизация и Пейвол',
            metric: 'Сумма успешных оплат (₽ / эквивалент)',
            last: `${Number(last.successful_payments_sum).toFixed(2)} ₽`,
            prev: `${Number(prev.successful_payments_sum).toFixed(2)} ₽`,
            change: calcChange(Number(last.successful_payments_sum), Number(prev.successful_payments_sum)),
            status: 'Активно',
            note: 'Фактическая выручка за период'
        }
    ];

    const escapeCsv = (val: any) => {
        const s = String(val ?? '');
        if (s.includes(';') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
            return '"' + s.split('"').join('""') + '"';
        }
        return s;
    };

    const csvLines: string[] = [];

    // Header 1: Main Funnel
    csvLines.push(['=== ОСНОВНАЯ ВОРОНКА VIReyou (PORTAL + BOT) ==='].map(escapeCsv).join(';'));
    const csvHeader = [
        'Категория',
        'Метрика',
        `Последние 7 дней (${lastRange})`,
        `Предыдущие 7 дней (${prevRange})`,
        'Динамика',
        'Статус в БД',
        'Примечание'
    ];
    csvLines.push(csvHeader.map(escapeCsv).join(';'));

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

    // Spacer
    csvLines.push('');
    csvLines.push(['=== ТОП-5 КАМПАНИЙ ПО ВИЗИТАМ ЗА 7 ДНЕЙ ==='].map(escapeCsv).join(';'));

    const campHeader = [
        'Кампания (utm_campaign / start_param)',
        'Источник (utm_source)',
        'Визиты портала',
        'Старты тестов',
        'Завершено тестов',
        'Запуски бота',
        'Клики оплаты'
    ];
    csvLines.push(campHeader.map(escapeCsv).join(';'));

    if (topCampaigns.length > 0) {
        for (const c of topCampaigns) {
            csvLines.push([
                c.campaign,
                c.source,
                c.visits,
                c.test_starts,
                c.test_completes,
                c.bot_starts,
                c.checkout_clicks
            ].map(escapeCsv).join(';'));
        }
    } else {
        csvLines.push([
            '(данные накапливаются: новые события с UTM метками)',
            '-',
            0,
            0,
            0,
            0,
            0
        ].map(escapeCsv).join(';'));
    }

    const csvContent = '\uFEFF' + csvLines.join('\r\n');

    const dateStr = getFormattedDate();
    const fileName = `vireyou_funnel_${dateStr}.csv`;

    const gdriveDir = '/Users/mogilevandrei/Library/CloudStorage/GoogleDrive-mogilev.andrey@gmail.com/Мой диск/VIReyou/VIReyou_Аналитика';
    const localDir = path.resolve(__dirname, 'exports');

    const savedPaths: string[] = [];

    // Local exports folder
    if (!fs.existsSync(localDir)) {
        fs.mkdirSync(localDir, { recursive: true });
    }
    const localFilePath = path.join(localDir, fileName);
    fs.writeFileSync(localFilePath, csvContent, 'utf8');
    savedPaths.push(localFilePath);

    // Google Drive
    if (fs.existsSync(gdriveDir)) {
        const gdriveFilePath = path.join(gdriveDir, fileName);
        fs.writeFileSync(gdriveFilePath, csvContent, 'utf8');
        savedPaths.push(gdriveFilePath);
        console.log(`[METRICS EXPORT] Successfully saved to Google Drive: ${gdriveFilePath}`);
    } else {
        console.warn(`[METRICS EXPORT] Google Drive directory not accessible: ${gdriveDir}`);
    }

    console.log(`[METRICS EXPORT] Export completed: ${fileName}`);
    console.log(`[METRICS EXPORT] Saved to:\n - ${savedPaths.join('\n - ')}`);

    return {
        fileName,
        savedPaths,
        csvContent,
        topCampaignsCount: topCampaigns.length
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
