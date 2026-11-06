-- Security Verification Script for RLS Policies (Dry Run)
-- Runs inside a transaction and ALWAYS rolls back at the end.
-- Date: 2026-11-06

BEGIN;

-- ============================================================================
-- PART 1: AUTHENTICATED USER CONTEXT (dc39e0c0-8016-4ca6-8a80-17e1950b6b6a)
-- ============================================================================
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"dc39e0c0-8016-4ca6-8a80-17e1950b6b6a","role":"authenticated"}', true);

-- Check 1: User tries to extend their own subscription on User table
-- Expected: ERROR 42501 (insufficient_privilege - permission denied for table User)
DO $$
BEGIN
    UPDATE "User"
    SET subscription_expires_at = now() + interval '10 years'
    WHERE id = (auth.uid())::text;
    RAISE EXCEPTION 'CHECK 1 FAILED: User subscription_expires_at UPDATE was not blocked!';
EXCEPTION
    WHEN insufficient_privilege THEN
        RAISE NOTICE 'CHECK 1 PASSED: permission denied for table User (subscription_expires_at)';
END $$;

-- Check 2: User tries to escalate privileges to admin on User table
-- Expected: ERROR 42501 (insufficient_privilege - permission denied for table User)
DO $$
BEGIN
    UPDATE "User"
    SET role = 'admin'
    WHERE id = (auth.uid())::text;
    RAISE EXCEPTION 'CHECK 2 FAILED: User role UPDATE was not blocked!';
EXCEPTION
    WHEN insufficient_privilege THEN
        RAISE NOTICE 'CHECK 2 PASSED: permission denied for table User (role)';
END $$;

-- Check 3: User tries to escalate privileges to admin on profiles table
-- Expected: ERROR 42501 (insufficient_privilege - permission denied for column role of relation profiles)
DO $$
BEGIN
    UPDATE "profiles"
    SET role = 'admin'
    WHERE id = (auth.uid())::uuid;
    RAISE EXCEPTION 'CHECK 3 FAILED: profiles role UPDATE was not blocked!';
EXCEPTION
    WHEN insufficient_privilege THEN
        RAISE NOTICE 'CHECK 3 PASSED: permission denied for column role of relation profiles';
END $$;

-- Check 4a: User updates their assigned specialist on profiles (own row)
-- Expected: UPDATE 0 (because profiles has 0 rows for this user), no permission error
DO $$
DECLARE
    affected int;
BEGIN
    UPDATE "profiles"
    SET assigned_specialist_id = '563938a6-2ca7-44db-9604-d60673b56c08'
    WHERE id = (auth.uid())::uuid;
    GET DIAGNOSTICS affected = ROW_COUNT;
    IF affected = 0 THEN
        RAISE NOTICE 'CHECK 4a PASSED: UPDATE 0 (profiles has 0 rows, column update permitted)';
    ELSE
        RAISE NOTICE 'CHECK 4a PASSED: UPDATE % rows (column update permitted)', affected;
    END IF;
END $$;

-- Check 4b: UPDATE чужих строк NutritionLog
-- Expected: ERROR 42501 (insufficient_privilege)
DO $$
BEGIN
    UPDATE "NutritionLog"
    SET description = 'hacked'
    WHERE user_id = '00000000-0000-0000-0000-000000000000';
    RAISE EXCEPTION 'CHECK 4b FAILED: NutritionLog UPDATE was not blocked!';
EXCEPTION
    WHEN insufficient_privilege THEN
        RAISE NOTICE 'CHECK 4b PASSED: permission denied for table NutritionLog (UPDATE)';
END $$;

-- Check 4c: DELETE чужих строк NutritionLog
-- Expected: ERROR 42501 (insufficient_privilege)
DO $$
BEGIN
    DELETE FROM "NutritionLog"
    WHERE user_id = '00000000-0000-0000-0000-000000000000';
    RAISE EXCEPTION 'CHECK 4c FAILED: NutritionLog DELETE was not blocked!';
EXCEPTION
    WHEN insufficient_privilege THEN
        RAISE NOTICE 'CHECK 4c PASSED: permission denied for table NutritionLog (DELETE)';
END $$;

-- Check 4d: UPDATE чужих строк test_results
-- Expected: ERROR 42501 (insufficient_privilege)
DO $$
BEGIN
    UPDATE "test_results"
    SET score = 999
    WHERE user_id = '00000000-0000-0000-0000-000000000000'::uuid;
    RAISE EXCEPTION 'CHECK 4d FAILED: test_results UPDATE was not blocked!';
EXCEPTION
    WHEN insufficient_privilege THEN
        RAISE NOTICE 'CHECK 4d PASSED: permission denied for table test_results (UPDATE)';
END $$;

-- Check 4e: DELETE чужих строк test_results
-- Expected: ERROR 42501 (insufficient_privilege)
DO $$
BEGIN
    DELETE FROM "test_results"
    WHERE user_id = '00000000-0000-0000-0000-000000000000'::uuid;
    RAISE EXCEPTION 'CHECK 4e FAILED: test_results DELETE was not blocked!';
EXCEPTION
    WHEN insufficient_privilege THEN
        RAISE NOTICE 'CHECK 4e PASSED: permission denied for table test_results (DELETE)';
END $$;

-- Check 5a: User inserts test_results for themselves
-- Expected: INSERT 1 (allowed by INSERT policy)
DO $$
DECLARE
    affected int;
BEGIN
    INSERT INTO "test_results" (user_id, test_type, score, interpretation)
    VALUES ((auth.uid())::uuid, 'sarc-f', 1, 'Test verification');
    GET DIAGNOSTICS affected = ROW_COUNT;
    IF affected = 1 THEN
        RAISE NOTICE 'CHECK 5a PASSED: INSERT 1 (own test result inserted successfully)';
    ELSE
        RAISE EXCEPTION 'CHECK 5a FAILED: expected 1 row inserted, got %', affected;
    END IF;
END $$;

-- Check 5b: User inserts test_results for another user
-- Expected: ERROR 42501 / check_violation (new row violates row-level security policy for table "test_results")
DO $$
BEGIN
    INSERT INTO "test_results" (user_id, test_type, score, interpretation)
    VALUES ('00000000-0000-0000-0000-000000000000'::uuid, 'sarc-f', 10, 'Attacker spoof');
    RAISE EXCEPTION 'CHECK 5b FAILED: spoofed insert was not blocked!';
EXCEPTION
    WHEN insufficient_privilege OR check_violation THEN
        RAISE NOTICE 'CHECK 5b PASSED: spoofed insert blocked by RLS';
END $$;

-- Check 6a: User tries to insert into AccessPermission for themselves
-- Expected: ERROR 42501 (insufficient_privilege - permission denied for table AccessPermission)
DO $$
BEGIN
    INSERT INTO "AccessPermission" (id, user_id, test_id)
    VALUES ('test-perm-id', (auth.uid())::text, 'bio-age');
    RAISE EXCEPTION 'CHECK 6a FAILED: AccessPermission INSERT was not blocked!';
EXCEPTION
    WHEN insufficient_privilege THEN
        RAISE NOTICE 'CHECK 6a PASSED: permission denied for table AccessPermission';
END $$;

-- Check 6b: User tries to insert into Transaction for themselves
-- Expected: ERROR 42501 (insufficient_privilege - permission denied for table Transaction)
DO $$
BEGIN
    INSERT INTO "Transaction" (id, user_id, amount, type, description)
    VALUES ('test-tx-id', (auth.uid())::text, 100.00, 'deposit', 'test');
    RAISE EXCEPTION 'CHECK 6b FAILED: Transaction INSERT was not blocked!';
EXCEPTION
    WHEN insufficient_privilege THEN
        RAISE NOTICE 'CHECK 6b PASSED: permission denied for table Transaction';
END $$;

-- Check 7: User tries to delete posts from Content Factory
-- Expected: ERROR 42501 (insufficient_privilege - permission denied for table posts)
DO $$
BEGIN
    DELETE FROM "posts" WHERE true;
    RAISE EXCEPTION 'CHECK 7 FAILED: posts DELETE was not blocked!';
EXCEPTION
    WHEN insufficient_privilege THEN
        RAISE NOTICE 'CHECK 7 PASSED: permission denied for table posts';
END $$;

-- Check 8a: SELECT count(*) FROM User
-- Expected: returns exactly 1 (own user row only)
DO $$
DECLARE
    cnt int;
BEGIN
    SELECT count(*) INTO cnt FROM "User";
    IF cnt = 1 THEN
        RAISE NOTICE 'CHECK 8a PASSED: User SELECT count = 1 (strictly own row)';
    ELSE
        RAISE EXCEPTION 'CHECK 8a FAILED: expected User count = 1, got %', cnt;
    END IF;
END $$;

-- Check 8b: SELECT count(*) FROM NutritionLog
-- Expected: returns count of own rows (> 0)
DO $$
DECLARE
    cnt int;
BEGIN
    SELECT count(*) INTO cnt FROM "NutritionLog";
    IF cnt > 0 THEN
        RAISE NOTICE 'CHECK 8b PASSED: NutritionLog SELECT count = % (only own rows returned, > 0)', cnt;
    ELSE
        RAISE EXCEPTION 'CHECK 8b FAILED: expected NutritionLog count > 0, got 0';
    END IF;
END $$;

-- ============================================================================
-- PART 2: ANON ROLE CONTEXT (UNAUTHENTICATED PUBLIC ACCESS)
-- ============================================================================
SET LOCAL ROLE anon;

-- Check Anon 1: SELECT from User
DO $$
DECLARE
    cnt int;
BEGIN
    SELECT count(*) INTO cnt FROM "User";
    RAISE EXCEPTION 'CHECK ANON 1 FAILED: anon was able to read User table (count: %)', cnt;
EXCEPTION
    WHEN insufficient_privilege THEN
        RAISE NOTICE 'CHECK ANON 1 PASSED: permission denied for table User (anon)';
END $$;

-- Check Anon 2: SELECT from NutritionLog
DO $$
DECLARE
    cnt int;
BEGIN
    SELECT count(*) INTO cnt FROM "NutritionLog";
    RAISE EXCEPTION 'CHECK ANON 2 FAILED: anon was able to read NutritionLog table (count: %)', cnt;
EXCEPTION
    WHEN insufficient_privilege THEN
        RAISE NOTICE 'CHECK ANON 2 PASSED: permission denied for table NutritionLog (anon)';
END $$;

-- Check Anon 3: SELECT from test_results
DO $$
DECLARE
    cnt int;
BEGIN
    SELECT count(*) INTO cnt FROM "test_results";
    RAISE EXCEPTION 'CHECK ANON 3 FAILED: anon was able to read test_results table (count: %)', cnt;
EXCEPTION
    WHEN insufficient_privilege THEN
        RAISE NOTICE 'CHECK ANON 3 PASSED: permission denied for table test_results (anon)';
END $$;

-- Always roll back test mutations
ROLLBACK;
