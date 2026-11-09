-- DRAFT Migration: Partial Unique Index to prevent duplicate test_complete events per session and test
-- Date: 2026-11-09
-- Status: DRAFT / DO NOT APPLY WITHOUT CONFIRMATION

-- Index ensures that for any given session_id and testType, test_complete can be recorded at most once
CREATE UNIQUE INDEX IF NOT EXISTS idx_analytics_unique_test_complete_per_session
ON public."AnalyticsEvent" (session_id, COALESCE(meta->>'testType', meta->>'testId', meta->>'slug'))
WHERE event = 'test_complete';

