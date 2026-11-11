-- ROLLBACK Migration: Revert 20261106_rls_policies_readonly.sql to original state
-- Restores all original 'ALL' policies and role table grants
-- Date: 2026-11-06

BEGIN;

-- ============================================================================
-- 1. RESTORE ROLE TABLE GRANTS TO anon AND authenticated
-- ============================================================================
GRANT ALL ON TABLE
    "User", "Transaction", "AccessPermission", "Squad", "SquadParticipant",
    "Consultation", "MedicalDocument", "BiomarkerResult", "HealthData", "ActivityLog",
    "HabitLog", "HydrationLog", "NutritionLog", "SleepLog", "FoodItem", "SystemSetting",
    "Test", "test_results", "profiles", "carousel_slides", "content_factory_settings",
    "max_users", "posts", "projects", "publication_logs", "veo_video_assets", "weekly_hubs"
TO anon, authenticated;

-- ============================================================================
-- 2. RESTORE ORIGINAL 'ALL' RLS POLICIES
-- ============================================================================

-- Drop read-only policies
DROP POLICY IF EXISTS "Users can view their own User" ON "User";
DROP POLICY IF EXISTS "Users can view their own Transaction" ON "Transaction";
DROP POLICY IF EXISTS "Users can view their own AccessPermission" ON "AccessPermission";
DROP POLICY IF EXISTS "Users can view their own Squad" ON "Squad";
DROP POLICY IF EXISTS "Users can view their own SquadParticipant" ON "SquadParticipant";
DROP POLICY IF EXISTS "Users can view their own Consultation" ON "Consultation";
DROP POLICY IF EXISTS "Users can view their own MedicalDocument" ON "MedicalDocument";
DROP POLICY IF EXISTS "Users can view their own BiomarkerResult" ON "BiomarkerResult";
DROP POLICY IF EXISTS "Users can view their own HealthData" ON "HealthData";
DROP POLICY IF EXISTS "Users can view their own ActivityLog" ON "ActivityLog";
DROP POLICY IF EXISTS "Users can view their own HabitLog" ON "HabitLog";
DROP POLICY IF EXISTS "Users can view their own HydrationLog" ON "HydrationLog";
DROP POLICY IF EXISTS "Users can view their own NutritionLog" ON "NutritionLog";
DROP POLICY IF EXISTS "Users can view their own SleepLog" ON "SleepLog";
DROP POLICY IF EXISTS "Users can view their own test_results" ON "test_results";
DROP POLICY IF EXISTS "Users can insert their own test_results" ON "test_results";
DROP POLICY IF EXISTS "Users can view their own profiles" ON "profiles";
DROP POLICY IF EXISTS "profiles_update_own" ON "profiles";
DROP POLICY IF EXISTS "Authenticated users can read FoodItem" ON "FoodItem";
DROP POLICY IF EXISTS "Authenticated users can read SystemSetting" ON "SystemSetting";
DROP POLICY IF EXISTS "Authenticated users can read Test" ON "Test";

-- Re-create original ALL policies
CREATE POLICY "Users can access their own User" ON "User"
    FOR ALL TO authenticated
    USING (id = (auth.uid())::text)
    WITH CHECK (id = (auth.uid())::text);

CREATE POLICY "Users can access their own Transaction" ON "Transaction"
    FOR ALL TO authenticated
    USING (user_id = (auth.uid())::text)
    WITH CHECK (user_id = (auth.uid())::text);

CREATE POLICY "Users can access their own AccessPermission" ON "AccessPermission"
    FOR ALL TO authenticated
    USING (user_id = (auth.uid())::text)
    WITH CHECK (user_id = (auth.uid())::text);

CREATE POLICY "Users can access their own Squad" ON "Squad"
    FOR ALL TO authenticated
    USING (creator_id = (auth.uid())::text)
    WITH CHECK (creator_id = (auth.uid())::text);

CREATE POLICY "Users can access their own SquadParticipant" ON "SquadParticipant"
    FOR ALL TO authenticated
    USING (user_id = (auth.uid())::text)
    WITH CHECK (user_id = (auth.uid())::text);

CREATE POLICY "Users can access their own Consultation" ON "Consultation"
    FOR ALL TO authenticated
    USING (((client_id = (auth.uid())::text) OR (specialist_id = (auth.uid())::text)))
    WITH CHECK (((client_id = (auth.uid())::text) OR (specialist_id = (auth.uid())::text)));

CREATE POLICY "Users can access their own MedicalDocument" ON "MedicalDocument"
    FOR ALL TO authenticated
    USING (user_id = (auth.uid())::text)
    WITH CHECK (user_id = (auth.uid())::text);

CREATE POLICY "Users can access their own BiomarkerResult" ON "BiomarkerResult"
    FOR ALL TO authenticated
    USING (user_id = (auth.uid())::text)
    WITH CHECK (user_id = (auth.uid())::text);

CREATE POLICY "Users can access their own HealthData" ON "HealthData"
    FOR ALL TO authenticated
    USING (user_id = (auth.uid())::text)
    WITH CHECK (user_id = (auth.uid())::text);

CREATE POLICY "Users can access their own ActivityLog" ON "ActivityLog"
    FOR ALL TO authenticated
    USING (user_id = (auth.uid())::text)
    WITH CHECK (user_id = (auth.uid())::text);

CREATE POLICY "Users can access their own HabitLog" ON "HabitLog"
    FOR ALL TO authenticated
    USING (user_id = (auth.uid())::text)
    WITH CHECK (user_id = (auth.uid())::text);

CREATE POLICY "Users can access their own HydrationLog" ON "HydrationLog"
    FOR ALL TO authenticated
    USING (user_id = (auth.uid())::text)
    WITH CHECK (user_id = (auth.uid())::text);

CREATE POLICY "Users can access their own NutritionLog" ON "NutritionLog"
    FOR ALL TO authenticated
    USING (user_id = (auth.uid())::text)
    WITH CHECK (user_id = (auth.uid())::text);

CREATE POLICY "Users can access their own SleepLog" ON "SleepLog"
    FOR ALL TO authenticated
    USING (user_id = (auth.uid())::text)
    WITH CHECK (user_id = (auth.uid())::text);

CREATE POLICY "Users can access their own test_results" ON "test_results"
    FOR ALL TO authenticated
    USING (((user_id)::text = (auth.uid())::text))
    WITH CHECK (((user_id)::text = (auth.uid())::text));

CREATE POLICY "Users can access their own profiles" ON "profiles"
    FOR ALL TO authenticated
    USING (((id)::text = (auth.uid())::text))
    WITH CHECK (((id)::text = (auth.uid())::text));

CREATE POLICY "Authenticated users can access FoodItem" ON "FoodItem"
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can access SystemSetting" ON "SystemSetting"
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can access Test" ON "Test"
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can access carousel_slides" ON "carousel_slides"
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can access content_factory_settings" ON "content_factory_settings"
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can access max_users" ON "max_users"
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can access posts" ON "posts"
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can access projects" ON "projects"
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can access publication_logs" ON "publication_logs"
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can access veo_video_assets" ON "veo_video_assets"
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can access weekly_hubs" ON "weekly_hubs"
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

COMMIT;
