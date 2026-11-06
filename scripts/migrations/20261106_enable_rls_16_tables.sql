-- Migration: Enable RLS and Revoke Public/Authenticated grants on 16 internal tables
-- Date: 2026-11-06

BEGIN;

-- 1. Enable Row Level Security
ALTER TABLE "AdviceLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AssistantMessage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AssistantState" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ConsultantLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DailyActionLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DisclosureLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DomainBaseline" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EngagementState" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "HabitEpisode" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "NutrientCalc" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PatternContent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TipContent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TopicMention" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "knowledge_cards" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "knowledge_gaps" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "used_auth_tokens" ENABLE ROW LEVEL SECURITY;

-- 2. Revoke permissions from anon and authenticated roles
REVOKE ALL ON TABLE "AdviceLog" FROM anon, authenticated;
REVOKE ALL ON TABLE "AssistantMessage" FROM anon, authenticated;
REVOKE ALL ON TABLE "AssistantState" FROM anon, authenticated;
REVOKE ALL ON TABLE "ConsultantLog" FROM anon, authenticated;
REVOKE ALL ON TABLE "DailyActionLog" FROM anon, authenticated;
REVOKE ALL ON TABLE "DisclosureLog" FROM anon, authenticated;
REVOKE ALL ON TABLE "DomainBaseline" FROM anon, authenticated;
REVOKE ALL ON TABLE "EngagementState" FROM anon, authenticated;
REVOKE ALL ON TABLE "HabitEpisode" FROM anon, authenticated;
REVOKE ALL ON TABLE "NutrientCalc" FROM anon, authenticated;
REVOKE ALL ON TABLE "PatternContent" FROM anon, authenticated;
REVOKE ALL ON TABLE "TipContent" FROM anon, authenticated;
REVOKE ALL ON TABLE "TopicMention" FROM anon, authenticated;
REVOKE ALL ON TABLE "knowledge_cards" FROM anon, authenticated;
REVOKE ALL ON TABLE "knowledge_gaps" FROM anon, authenticated;
REVOKE ALL ON TABLE "used_auth_tokens" FROM anon, authenticated;

COMMIT;

