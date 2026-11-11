-- Migration: 20261109_weekly_funnel_filter_internal.sql
-- Description: Updates public.weekly_funnel view to exclude internal team traffic (admin users, internal IDs, and vireyou_internal cookie/sessions)
-- Preserves unfiltered total metrics alongside as '*_total' / '*_all'

DROP VIEW IF EXISTS public.weekly_funnel CASCADE;

CREATE VIEW public.weekly_funnel AS
WITH periods AS (
    SELECT 'last_7_days'::text AS period,
        1 AS sort_order,
        (now() - '7 days'::interval) AS start_date,
        now() AS end_date,
        (now() - '14 days'::interval) AS cohort_start,
        (now() - '7 days'::interval) AS cohort_end
    UNION ALL
    SELECT 'previous_7_days'::text AS period,
        2 AS sort_order,
        (now() - '14 days'::interval) AS start_date,
        (now() - '7 days'::interval) AS end_date,
        (now() - '21 days'::interval) AS cohort_start,
        (now() - '14 days'::interval) AS cohort_end
),
internal_ids AS (
    SELECT id::text AS id FROM "User" WHERE role = 'admin'
    UNION
    SELECT unnest(ARRAY[
        'dc39e0c0-8016-4ca6-8a80-17e1950b6b6a', -- Андрей (admin)
        '2fe15dcd-a2ad-416e-a7e3-efa7a81750b1'  -- Валентина
    ]::text[])
),
internal_sessions AS (
    SELECT DISTINCT session_id FROM "AnalyticsEvent"
    WHERE session_id IS NOT NULL
      AND (
        meta->>'is_internal' = 'true'
        OR user_id IN (SELECT id FROM internal_ids)
      )
)
SELECT period,
    (start_date)::date AS period_start,
    (end_date)::date AS period_end,

    -- 0. Трафик и Визиты портала
    ( SELECT count(*)::integer FROM "AnalyticsEvent" ae
      WHERE ae.event = 'portal_visit' AND ae.created_at >= p.start_date AND ae.created_at < p.end_date
        AND ae.meta->>'is_internal' IS DISTINCT FROM 'true'
        AND (ae.user_id IS NULL OR ae.user_id NOT IN (SELECT id FROM internal_ids))
        AND NOT EXISTS (SELECT 1 FROM internal_sessions s WHERE s.session_id = ae.session_id)
    ) AS portal_visits,

    ( SELECT count(*)::integer FROM "AnalyticsEvent" ae
      WHERE ae.event = 'portal_visit' AND ae.created_at >= p.start_date AND ae.created_at < p.end_date
    ) AS portal_visits_total,

    ( SELECT count(*)::integer FROM "AnalyticsEvent" ae
      WHERE ae.event = 'portal_visit' AND ae.utm_source IS NOT NULL AND ae.created_at >= p.start_date AND ae.created_at < p.end_date
        AND ae.meta->>'is_internal' IS DISTINCT FROM 'true'
        AND (ae.user_id IS NULL OR ae.user_id NOT IN (SELECT id FROM internal_ids))
        AND NOT EXISTS (SELECT 1 FROM internal_sessions s WHERE s.session_id = ae.session_id)
    ) AS portal_visits_utm,

    ( SELECT count(*)::integer FROM "AnalyticsEvent" ae
      WHERE ae.event = 'portal_visit' AND ae.utm_source IS NOT NULL AND ae.created_at >= p.start_date AND ae.created_at < p.end_date
    ) AS portal_visits_utm_total,

    -- 1. Привлечение и Бот
    ( SELECT count(*)::integer FROM "User" u
      WHERE u.telegram_id IS NOT NULL AND u.created_at >= p.start_date AND u.created_at < p.end_date
        AND u.id NOT IN (SELECT id FROM internal_ids)
    ) AS bot_reg_total,

    ( SELECT count(*)::integer FROM "User" u
      WHERE u.telegram_id IS NOT NULL AND u.created_at >= p.start_date AND u.created_at < p.end_date
    ) AS bot_reg_total_all,

    ( SELECT count(*)::integer FROM "User" u
      WHERE u.telegram_id IS NOT NULL AND u.referrer_id IS NOT NULL AND u.created_at >= p.start_date AND u.created_at < p.end_date
        AND u.id NOT IN (SELECT id FROM internal_ids)
    ) AS bot_reg_with_referrer,

    ( SELECT count(*)::integer FROM "User" u
      WHERE u.telegram_id IS NOT NULL AND u.start_param IS NOT NULL AND u.created_at >= p.start_date AND u.created_at < p.end_date
        AND u.id NOT IN (SELECT id FROM internal_ids)
    ) AS bot_reg_with_start_param,

    ( SELECT count(*)::integer FROM "User" u
      WHERE u.telegram_id IS NOT NULL AND u.referrer_id IS NULL AND u.start_param IS NULL AND u.created_at >= p.start_date AND u.created_at < p.end_date
        AND u.id NOT IN (SELECT id FROM internal_ids)
    ) AS bot_reg_organic,

    ( SELECT count(*)::integer FROM "AnalyticsEvent" ae
      WHERE ae.event = 'bot_start' AND ae.created_at >= p.start_date AND ae.created_at < p.end_date
        AND ae.meta->>'is_internal' IS DISTINCT FROM 'true'
        AND (ae.user_id IS NULL OR ae.user_id NOT IN (SELECT id FROM internal_ids))
        AND NOT EXISTS (SELECT 1 FROM internal_sessions s WHERE s.session_id = ae.session_id)
    ) AS bot_start_total,

    ( SELECT count(*)::integer FROM "AnalyticsEvent" ae
      WHERE ae.event = 'bot_start' AND ae.created_at >= p.start_date AND ae.created_at < p.end_date
    ) AS bot_start_total_all,

    ( SELECT count(*)::integer FROM "AnalyticsEvent" ae
      WHERE ae.event = 'bot_start' AND ae.utm_source = 'youtube' AND ae.created_at >= p.start_date AND ae.created_at < p.end_date
        AND ae.meta->>'is_internal' IS DISTINCT FROM 'true'
        AND (ae.user_id IS NULL OR ae.user_id NOT IN (SELECT id FROM internal_ids))
        AND NOT EXISTS (SELECT 1 FROM internal_sessions s WHERE s.session_id = ae.session_id)
    ) AS bot_start_yt,

    ( SELECT count(*)::integer FROM "AnalyticsEvent" ae
      WHERE ae.event = 'bot_signup' AND ae.created_at >= p.start_date AND ae.created_at < p.end_date
        AND ae.meta->>'is_internal' IS DISTINCT FROM 'true'
        AND (ae.user_id IS NULL OR ae.user_id NOT IN (SELECT id FROM internal_ids))
        AND NOT EXISTS (SELECT 1 FROM internal_sessions s WHERE s.session_id = ae.session_id)
    ) AS event_bot_signups,

    -- 2. Диагностика и Тесты
    ( SELECT count(*)::integer FROM test_results tr
      WHERE tr.created_at >= p.start_date AND tr.created_at < p.end_date
        AND (tr.user_id IS NULL OR tr.user_id::text NOT IN (SELECT id FROM internal_ids))
    ) AS tests_completed_total,

    ( SELECT count(*)::integer FROM test_results tr
      WHERE tr.created_at >= p.start_date AND tr.created_at < p.end_date
    ) AS tests_completed_total_all,

    ( SELECT count(DISTINCT tr.user_id)::integer FROM test_results tr
      WHERE tr.created_at >= p.start_date AND tr.created_at < p.end_date
        AND (tr.user_id IS NULL OR tr.user_id::text NOT IN (SELECT id FROM internal_ids))
    ) AS tests_unique_users,

    ( SELECT count(DISTINCT tr.user_id)::integer FROM test_results tr
      JOIN "User" u ON u.id = tr.user_id::text
      WHERE u.telegram_id IS NOT NULL AND tr.created_at >= p.start_date AND tr.created_at < p.end_date
        AND u.id NOT IN (SELECT id FROM internal_ids)
    ) AS tests_unique_users_in_bot,

    ( SELECT count(*)::integer FROM "AnalyticsEvent" ae
      WHERE ae.event = 'test_start' AND ae.created_at >= p.start_date AND ae.created_at < p.end_date
        AND ae.meta->>'is_internal' IS DISTINCT FROM 'true'
        AND (ae.user_id IS NULL OR ae.user_id NOT IN (SELECT id FROM internal_ids))
        AND NOT EXISTS (SELECT 1 FROM internal_sessions s WHERE s.session_id = ae.session_id)
    ) AS event_tests_started,

    ( SELECT count(*)::integer FROM "AnalyticsEvent" ae
      WHERE ae.event = 'test_start' AND ae.created_at >= p.start_date AND ae.created_at < p.end_date
    ) AS event_tests_started_total,

    ( SELECT count(*)::integer FROM "AnalyticsEvent" ae
      WHERE ae.event = 'test_complete' AND ae.created_at >= p.start_date AND ae.created_at < p.end_date
        AND ae.meta->>'is_internal' IS DISTINCT FROM 'true'
        AND (ae.user_id IS NULL OR ae.user_id NOT IN (SELECT id FROM internal_ids))
        AND NOT EXISTS (SELECT 1 FROM internal_sessions s WHERE s.session_id = ae.session_id)
    ) AS event_tests_completed_all,

    ( SELECT count(*)::integer FROM "AnalyticsEvent" ae
      WHERE ae.event = 'test_complete' AND ae.created_at >= p.start_date AND ae.created_at < p.end_date
    ) AS event_tests_completed_all_total,

    ( SELECT count(*)::integer FROM "AnalyticsEvent" ae
      WHERE ae.event = 'test_complete' AND ae.user_id IS NULL AND ae.created_at >= p.start_date AND ae.created_at < p.end_date
        AND ae.meta->>'is_internal' IS DISTINCT FROM 'true'
        AND NOT EXISTS (SELECT 1 FROM internal_sessions s WHERE s.session_id = ae.session_id)
    ) AS event_tests_completed_anon,

    -- Тесты по типам (test_results)
    ( SELECT count(*)::integer FROM test_results tr
      WHERE tr.test_type = 'systemic-bio-age' AND tr.created_at >= p.start_date AND tr.created_at < p.end_date
        AND (tr.user_id IS NULL OR tr.user_id::text NOT IN (SELECT id FROM internal_ids))
    ) AS test_systemic_bio_age,
    ( SELECT count(*)::integer FROM test_results tr
      JOIN "User" u ON u.id = tr.user_id::text
      WHERE tr.test_type = 'systemic-bio-age' AND u.telegram_id IS NOT NULL AND tr.created_at >= p.start_date AND tr.created_at < p.end_date
        AND u.id NOT IN (SELECT id FROM internal_ids)
    ) AS test_systemic_bio_age_in_bot,

    ( SELECT count(*)::integer FROM test_results tr
      WHERE tr.test_type = 'functional-reserve' AND tr.created_at >= p.start_date AND tr.created_at < p.end_date
        AND (tr.user_id IS NULL OR tr.user_id::text NOT IN (SELECT id FROM internal_ids))
    ) AS test_functional_reserve,
    ( SELECT count(*)::integer FROM test_results tr
      JOIN "User" u ON u.id = tr.user_id::text
      WHERE tr.test_type = 'functional-reserve' AND u.telegram_id IS NOT NULL AND tr.created_at >= p.start_date AND tr.created_at < p.end_date
        AND u.id NOT IN (SELECT id FROM internal_ids)
    ) AS test_functional_reserve_in_bot,

    ( SELECT count(*)::integer FROM test_results tr
      WHERE tr.test_type = 'energy' AND tr.created_at >= p.start_date AND tr.created_at < p.end_date
        AND (tr.user_id IS NULL OR tr.user_id::text NOT IN (SELECT id FROM internal_ids))
    ) AS test_energy,
    ( SELECT count(*)::integer FROM test_results tr
      JOIN "User" u ON u.id = tr.user_id::text
      WHERE tr.test_type = 'energy' AND u.telegram_id IS NOT NULL AND tr.created_at >= p.start_date AND tr.created_at < p.end_date
        AND u.id NOT IN (SELECT id FROM internal_ids)
    ) AS test_energy_in_bot,

    ( SELECT count(*)::integer FROM test_results tr
      WHERE tr.test_type = 'circadian' AND tr.created_at >= p.start_date AND tr.created_at < p.end_date
        AND (tr.user_id IS NULL OR tr.user_id::text NOT IN (SELECT id FROM internal_ids))
    ) AS test_circadian,
    ( SELECT count(*)::integer FROM test_results tr
      JOIN "User" u ON u.id = tr.user_id::text
      WHERE tr.test_type = 'circadian' AND u.telegram_id IS NOT NULL AND tr.created_at >= p.start_date AND tr.created_at < p.end_date
        AND u.id NOT IN (SELECT id FROM internal_ids)
    ) AS test_circadian_in_bot,

    ( SELECT count(*)::integer FROM test_results tr
      WHERE tr.test_type = 'insomnia' AND tr.created_at >= p.start_date AND tr.created_at < p.end_date
        AND (tr.user_id IS NULL OR tr.user_id::text NOT IN (SELECT id FROM internal_ids))
    ) AS test_insomnia,
    ( SELECT count(*)::integer FROM test_results tr
      JOIN "User" u ON u.id = tr.user_id::text
      WHERE tr.test_type = 'insomnia' AND u.telegram_id IS NOT NULL AND tr.created_at >= p.start_date AND tr.created_at < p.end_date
        AND u.id NOT IN (SELECT id FROM internal_ids)
    ) AS test_insomnia_in_bot,

    ( SELECT count(*)::integer FROM test_results tr
      WHERE tr.test_type = 'sarc-f' AND tr.created_at >= p.start_date AND tr.created_at < p.end_date
        AND (tr.user_id IS NULL OR tr.user_id::text NOT IN (SELECT id FROM internal_ids))
    ) AS test_sarc_f,
    ( SELECT count(*)::integer FROM test_results tr
      JOIN "User" u ON u.id = tr.user_id::text
      WHERE tr.test_type = 'sarc-f' AND u.telegram_id IS NOT NULL AND tr.created_at >= p.start_date AND tr.created_at < p.end_date
        AND u.id NOT IN (SELECT id FROM internal_ids)
    ) AS test_sarc_f_in_bot,

    -- Тесты по типам (AnalyticsEvent test_start)
    ( SELECT count(*)::integer FROM "AnalyticsEvent" ae
      WHERE ae.event = 'test_start' AND (ae.meta->>'testType' = 'systemic-bio-age') AND ae.created_at >= p.start_date AND ae.created_at < p.end_date
        AND ae.meta->>'is_internal' IS DISTINCT FROM 'true'
        AND (ae.user_id IS NULL OR ae.user_id NOT IN (SELECT id FROM internal_ids))
        AND NOT EXISTS (SELECT 1 FROM internal_sessions s WHERE s.session_id = ae.session_id)
    ) AS event_start_systemic_bio_age,

    ( SELECT count(*)::integer FROM "AnalyticsEvent" ae
      WHERE ae.event = 'test_start' AND (ae.meta->>'testType' = 'functional-reserve') AND ae.created_at >= p.start_date AND ae.created_at < p.end_date
        AND ae.meta->>'is_internal' IS DISTINCT FROM 'true'
        AND (ae.user_id IS NULL OR ae.user_id NOT IN (SELECT id FROM internal_ids))
        AND NOT EXISTS (SELECT 1 FROM internal_sessions s WHERE s.session_id = ae.session_id)
    ) AS event_start_functional_reserve,

    ( SELECT count(*)::integer FROM "AnalyticsEvent" ae
      WHERE ae.event = 'test_start' AND (ae.meta->>'testType' = 'energy') AND ae.created_at >= p.start_date AND ae.created_at < p.end_date
        AND ae.meta->>'is_internal' IS DISTINCT FROM 'true'
        AND (ae.user_id IS NULL OR ae.user_id NOT IN (SELECT id FROM internal_ids))
        AND NOT EXISTS (SELECT 1 FROM internal_sessions s WHERE s.session_id = ae.session_id)
    ) AS event_start_energy,

    ( SELECT count(*)::integer FROM "AnalyticsEvent" ae
      WHERE ae.event = 'test_start' AND (ae.meta->>'testType' = 'circadian') AND ae.created_at >= p.start_date AND ae.created_at < p.end_date
        AND ae.meta->>'is_internal' IS DISTINCT FROM 'true'
        AND (ae.user_id IS NULL OR ae.user_id NOT IN (SELECT id FROM internal_ids))
        AND NOT EXISTS (SELECT 1 FROM internal_sessions s WHERE s.session_id = ae.session_id)
    ) AS event_start_circadian,

    ( SELECT count(*)::integer FROM "AnalyticsEvent" ae
      WHERE ae.event = 'test_start' AND (ae.meta->>'testType' = 'insomnia') AND ae.created_at >= p.start_date AND ae.created_at < p.end_date
        AND ae.meta->>'is_internal' IS DISTINCT FROM 'true'
        AND (ae.user_id IS NULL OR ae.user_id NOT IN (SELECT id FROM internal_ids))
        AND NOT EXISTS (SELECT 1 FROM internal_sessions s WHERE s.session_id = ae.session_id)
    ) AS event_start_insomnia,

    ( SELECT count(*)::integer FROM "AnalyticsEvent" ae
      WHERE ae.event = 'test_start' AND (ae.meta->>'testType' = 'sarc-f') AND ae.created_at >= p.start_date AND ae.created_at < p.end_date
        AND ae.meta->>'is_internal' IS DISTINCT FROM 'true'
        AND (ae.user_id IS NULL OR ae.user_id NOT IN (SELECT id FROM internal_ids))
        AND NOT EXISTS (SELECT 1 FROM internal_sessions s WHERE s.session_id = ae.session_id)
    ) AS event_start_sarc_f,

    -- 3. Активация и продукт
    ( SELECT count(DISTINCT u.id)::integer FROM "User" u
      JOIN "NutritionLog" nl ON nl.user_id = u.id
      WHERE u.created_at >= p.start_date AND u.created_at < p.end_date AND nl.created_at <= (u.created_at + '24:00:00'::interval)
        AND u.id NOT IN (SELECT id FROM internal_ids)
    ) AS activated_users_24h,

    ( SELECT count(*)::integer FROM "AnalyticsEvent" ae
      WHERE ae.event = 'first_meal_logged' AND ae.created_at >= p.start_date AND ae.created_at < p.end_date
        AND ae.meta->>'is_internal' IS DISTINCT FROM 'true'
        AND (ae.user_id IS NULL OR ae.user_id NOT IN (SELECT id FROM internal_ids))
        AND NOT EXISTS (SELECT 1 FROM internal_sessions s WHERE s.session_id = ae.session_id)
    ) AS event_first_meals_logged,

    -- 4. Retention D7
    ( SELECT count(*)::integer FROM "User" u
      WHERE u.created_at >= p.cohort_start AND u.created_at < p.cohort_end
        AND u.id NOT IN (SELECT id FROM internal_ids)
    ) AS d7_cohort_size,

    ( SELECT count(DISTINCT u.id)::integer FROM "User" u
      WHERE u.created_at >= p.cohort_start AND u.created_at < p.cohort_end
        AND u.id NOT IN (SELECT id FROM internal_ids)
        AND (
          EXISTS (SELECT 1 FROM "NutritionLog" nl WHERE nl.user_id = u.id AND nl.created_at >= u.created_at + '7 days'::interval)
          OR EXISTS (SELECT 1 FROM "SleepLog" sl WHERE sl.user_id = u.id AND sl.created_at >= u.created_at + '7 days'::interval)
          OR EXISTS (SELECT 1 FROM "ActivityLog" al WHERE al.user_id = u.id AND al.created_at >= u.created_at + '7 days'::interval)
          OR EXISTS (SELECT 1 FROM "HydrationLog" hl WHERE hl.user_id = u.id AND hl.created_at >= u.created_at + '7 days'::interval)
          OR EXISTS (SELECT 1 FROM test_results tr WHERE tr.user_id::text = u.id AND tr.created_at >= u.created_at + '7 days'::interval)
        )
    ) AS d7_active_users,

    -- 5. Монетизация и Пейвол
    ( SELECT count(*)::integer FROM "AnalyticsEvent" ae
      WHERE ae.event = 'paywall_view' AND ae.created_at >= p.start_date AND ae.created_at < p.end_date
        AND ae.meta->>'is_internal' IS DISTINCT FROM 'true'
        AND (ae.user_id IS NULL OR ae.user_id NOT IN (SELECT id FROM internal_ids))
        AND NOT EXISTS (SELECT 1 FROM internal_sessions s WHERE s.session_id = ae.session_id)
    ) AS event_paywall_views,

    ( SELECT count(*)::integer FROM "AnalyticsEvent" ae
      WHERE ae.event = 'paywall_view' AND ae.created_at >= p.start_date AND ae.created_at < p.end_date
    ) AS event_paywall_views_total,

    ( SELECT count(*)::integer FROM "AnalyticsEvent" ae
      WHERE ae.event = 'paywall_view' AND ae.source = 'portal' AND ae.created_at >= p.start_date AND ae.created_at < p.end_date
        AND ae.meta->>'is_internal' IS DISTINCT FROM 'true'
        AND (ae.user_id IS NULL OR ae.user_id NOT IN (SELECT id FROM internal_ids))
        AND NOT EXISTS (SELECT 1 FROM internal_sessions s WHERE s.session_id = ae.session_id)
    ) AS event_paywall_portal,

    ( SELECT count(*)::integer FROM "AnalyticsEvent" ae
      WHERE ae.event = 'paywall_view' AND ae.source = 'telegram_bot' AND ae.created_at >= p.start_date AND ae.created_at < p.end_date
        AND ae.meta->>'is_internal' IS DISTINCT FROM 'true'
        AND (ae.user_id IS NULL OR ae.user_id NOT IN (SELECT id FROM internal_ids))
        AND NOT EXISTS (SELECT 1 FROM internal_sessions s WHERE s.session_id = ae.session_id)
    ) AS event_paywall_bot,

    ( SELECT count(*)::integer FROM "AnalyticsEvent" ae
      WHERE ae.event = 'checkout_click' AND ae.created_at >= p.start_date AND ae.created_at < p.end_date
        AND ae.meta->>'is_internal' IS DISTINCT FROM 'true'
        AND (ae.user_id IS NULL OR ae.user_id NOT IN (SELECT id FROM internal_ids))
        AND NOT EXISTS (SELECT 1 FROM internal_sessions s WHERE s.session_id = ae.session_id)
    ) AS event_checkout_clicks,

    ( SELECT count(*)::integer FROM "AnalyticsEvent" ae
      WHERE ae.event = 'checkout_click' AND ae.created_at >= p.start_date AND ae.created_at < p.end_date
    ) AS event_checkout_clicks_total,

    ( SELECT count(*)::integer FROM "Transaction" t
      WHERE t.type LIKE 'PENDING_%' AND t.created_at >= p.start_date AND t.created_at < p.end_date
        AND t.user_id NOT IN (SELECT id FROM internal_ids)
    ) AS checkout_clicks_pending,

    ( SELECT count(*)::integer FROM "Transaction" t
      WHERE t.type LIKE 'PENDING_%' AND t.created_at >= p.start_date AND t.created_at < p.end_date
    ) AS checkout_clicks_pending_total,

    ( SELECT count(*)::integer FROM "Transaction" t
      WHERE t.type IN ('SUBSCRIPTION', 'TELEGRAM_STARS') AND t.created_at >= p.start_date AND t.created_at < p.end_date
        AND t.user_id NOT IN (SELECT id FROM internal_ids)
    ) AS successful_payments_count,

    ( SELECT count(*)::integer FROM "Transaction" t
      WHERE t.type IN ('SUBSCRIPTION', 'TELEGRAM_STARS') AND t.created_at >= p.start_date AND t.created_at < p.end_date
    ) AS successful_payments_count_total,

    ( SELECT COALESCE(sum(abs(t.amount)), 0)::numeric(12,2) FROM "Transaction" t
      WHERE t.type IN ('SUBSCRIPTION', 'TELEGRAM_STARS') AND t.created_at >= p.start_date AND t.created_at < p.end_date
        AND t.user_id NOT IN (SELECT id FROM internal_ids)
    ) AS successful_payments_sum,

    ( SELECT COALESCE(sum(abs(t.amount)), 0)::numeric(12,2) FROM "Transaction" t
      WHERE t.type IN ('SUBSCRIPTION', 'TELEGRAM_STARS') AND t.created_at >= p.start_date AND t.created_at < p.end_date
    ) AS successful_payments_sum_total

FROM periods p
ORDER BY sort_order;

