-- Migration: Restrict RLS policies from ALL to SELECT/INSERT (read-only where appropriate)
-- With role-level privilege revocations and safety assertion DO block
-- Date: 2026-11-06

BEGIN;

-- ============================================================================
-- 1. DROP EXISTING OVERLY PERMISSIVE POLICIES (cmd = 'ALL')
-- ============================================================================
DROP POLICY IF EXISTS "Users can access their own User" ON "User";
DROP POLICY IF EXISTS "Users can access their own Transaction" ON "Transaction";
DROP POLICY IF EXISTS "Users can access their own AccessPermission" ON "AccessPermission";
DROP POLICY IF EXISTS "Users can access their own Squad" ON "Squad";
DROP POLICY IF EXISTS "Users can access their own SquadParticipant" ON "SquadParticipant";
DROP POLICY IF EXISTS "Users can access their own Consultation" ON "Consultation";
DROP POLICY IF EXISTS "Users can access their own MedicalDocument" ON "MedicalDocument";
DROP POLICY IF EXISTS "Users can access their own BiomarkerResult" ON "BiomarkerResult";
DROP POLICY IF EXISTS "Users can access their own HealthData" ON "HealthData";
DROP POLICY IF EXISTS "Users can access their own ActivityLog" ON "ActivityLog";
DROP POLICY IF EXISTS "Users can access their own HabitLog" ON "HabitLog";
DROP POLICY IF EXISTS "Users can access their own HydrationLog" ON "HydrationLog";
DROP POLICY IF EXISTS "Users can access their own NutritionLog" ON "NutritionLog";
DROP POLICY IF EXISTS "Users can access their own SleepLog" ON "SleepLog";
DROP POLICY IF EXISTS "Users can access their own test_results" ON "test_results";
DROP POLICY IF EXISTS "Users can access their own profiles" ON "profiles";
DROP POLICY IF EXISTS "Authenticated users can access FoodItem" ON "FoodItem";
DROP POLICY IF EXISTS "Authenticated users can access SystemSetting" ON "SystemSetting";
DROP POLICY IF EXISTS "Authenticated users can access Test" ON "Test";
DROP POLICY IF EXISTS "Authenticated users can access carousel_slides" ON "carousel_slides";
DROP POLICY IF EXISTS "Authenticated users can access content_factory_settings" ON "content_factory_settings";
DROP POLICY IF EXISTS "Authenticated users can access max_users" ON "max_users";
DROP POLICY IF EXISTS "Authenticated users can access posts" ON "posts";
DROP POLICY IF EXISTS "Authenticated users can access projects" ON "projects";
DROP POLICY IF EXISTS "Authenticated users can access publication_logs" ON "publication_logs";
DROP POLICY IF EXISTS "Authenticated users can access veo_video_assets" ON "veo_video_assets";
DROP POLICY IF EXISTS "Authenticated users can access weekly_hubs" ON "weekly_hubs";

-- ============================================================================
-- 2. CREATE STRICT LEAST-PRIVILEGE RLS POLICIES
-- ============================================================================

-- Personal user tables (SELECT only)
CREATE POLICY "Users can view their own User" ON "User"
    FOR SELECT TO authenticated
    USING (id = (auth.uid())::text);

CREATE POLICY "Users can view their own Transaction" ON "Transaction"
    FOR SELECT TO authenticated
    USING (user_id = (auth.uid())::text);

CREATE POLICY "Users can view their own AccessPermission" ON "AccessPermission"
    FOR SELECT TO authenticated
    USING (user_id = (auth.uid())::text);

CREATE POLICY "Users can view their own Squad" ON "Squad"
    FOR SELECT TO authenticated
    USING (creator_id = (auth.uid())::text);

CREATE POLICY "Users can view their own SquadParticipant" ON "SquadParticipant"
    FOR SELECT TO authenticated
    USING (user_id = (auth.uid())::text);

CREATE POLICY "Users can view their own Consultation" ON "Consultation"
    FOR SELECT TO authenticated
    USING (((client_id = (auth.uid())::text) OR (specialist_id = (auth.uid())::text)));

CREATE POLICY "Users can view their own MedicalDocument" ON "MedicalDocument"
    FOR SELECT TO authenticated
    USING (user_id = (auth.uid())::text);

CREATE POLICY "Users can view their own BiomarkerResult" ON "BiomarkerResult"
    FOR SELECT TO authenticated
    USING (user_id = (auth.uid())::text);

CREATE POLICY "Users can view their own HealthData" ON "HealthData"
    FOR SELECT TO authenticated
    USING (user_id = (auth.uid())::text);

CREATE POLICY "Users can view their own ActivityLog" ON "ActivityLog"
    FOR SELECT TO authenticated
    USING (user_id = (auth.uid())::text);

CREATE POLICY "Users can view their own HabitLog" ON "HabitLog"
    FOR SELECT TO authenticated
    USING (user_id = (auth.uid())::text);

CREATE POLICY "Users can view their own HydrationLog" ON "HydrationLog"
    FOR SELECT TO authenticated
    USING (user_id = (auth.uid())::text);

CREATE POLICY "Users can view their own NutritionLog" ON "NutritionLog"
    FOR SELECT TO authenticated
    USING (user_id = (auth.uid())::text);

CREATE POLICY "Users can view their own SleepLog" ON "SleepLog"
    FOR SELECT TO authenticated
    USING (user_id = (auth.uid())::text);

-- test_results: SELECT and INSERT only
CREATE POLICY "Users can view their own test_results" ON "test_results"
    FOR SELECT TO authenticated
    USING ((user_id)::text = (auth.uid())::text);

CREATE POLICY "Users can insert their own test_results" ON "test_results"
    FOR INSERT TO authenticated
    WITH CHECK ((user_id)::text = (auth.uid())::text);

-- profiles: SELECT and UPDATE own
CREATE POLICY "Users can view their own profiles" ON "profiles"
    FOR SELECT TO authenticated
    USING ((id)::text = (auth.uid())::text);

CREATE POLICY profiles_update_own ON "profiles"
    FOR UPDATE TO authenticated
    USING ((id)::text = (auth.uid())::text)
    WITH CHECK ((id)::text = (auth.uid())::text);

-- Shared dictionary tables (SELECT only)
CREATE POLICY "Authenticated users can read FoodItem" ON "FoodItem"
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read SystemSetting" ON "SystemSetting"
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read Test" ON "Test"
    FOR SELECT TO authenticated USING (true);

-- ============================================================================
-- 3. ROLE-LEVEL PRIVILEGE REVOCATIONS (DEFENSE IN DEPTH)
-- ============================================================================

-- Revoke all access from anon on all tables
REVOKE ALL ON TABLE "User", "Transaction", "AccessPermission", "Squad", "SquadParticipant",
    "Consultation", "MedicalDocument", "BiomarkerResult", "HealthData", "ActivityLog",
    "HabitLog", "HydrationLog", "NutritionLog", "SleepLog", "FoodItem", "SystemSetting",
    "Test", "test_results", "profiles", "carousel_slides", "content_factory_settings",
    "max_users", "posts", "projects", "publication_logs", "veo_video_assets", "weekly_hubs"
FROM anon;

-- Revoke write privileges from authenticated on personal data and dictionary tables
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE
    "User", "Transaction", "AccessPermission", "Squad", "SquadParticipant",
    "Consultation", "MedicalDocument", "BiomarkerResult", "HealthData", "ActivityLog",
    "HabitLog", "HydrationLog", "NutritionLog", "SleepLog", "FoodItem", "SystemSetting", "Test"
FROM authenticated;

-- test_results: allow SELECT and INSERT only
REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE "test_results"
FROM authenticated;

-- profiles: allow SELECT and column-level UPDATE on assigned_specialist_id only
REVOKE ALL ON TABLE "profiles" FROM authenticated;
GRANT SELECT ON TABLE "profiles" TO authenticated;
GRANT UPDATE (assigned_specialist_id) ON TABLE "profiles" TO authenticated;

-- Content Factory: complete revoke from authenticated (Prisma only)
REVOKE ALL ON TABLE "carousel_slides", "content_factory_settings", "max_users", "posts",
    "projects", "publication_logs", "veo_video_assets", "weekly_hubs"
FROM authenticated;

-- ============================================================================
-- 4. ASSERTION: VERIFY NO 'ALL' POLICIES REMAIN ON PROTECTED TABLES
-- ============================================================================
DO $$ DECLARE n int; BEGIN
  SELECT count(*) INTO n FROM pg_policies
  WHERE schemaname='public' AND cmd='ALL'
    AND tablename IN ('User','Transaction','AccessPermission','Squad','SquadParticipant',
                      'Consultation','MedicalDocument','BiomarkerResult','HealthData',
                      'ActivityLog','HabitLog','HydrationLog','NutritionLog','SleepLog',
                      'test_results','profiles','FoodItem','SystemSetting','Test',
                      'carousel_slides','content_factory_settings','max_users','posts',
                      'projects','publication_logs','veo_video_assets','weekly_hubs');
  IF n > 0 THEN RAISE EXCEPTION 'ALL policies still present: %', n; END IF;
END $$;

COMMIT;
