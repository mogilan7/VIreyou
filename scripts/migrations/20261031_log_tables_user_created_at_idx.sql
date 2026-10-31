-- Migration: Add composite indexes on (user_id, created_at) for 5 log tables
-- Run outside a transaction block because of CONCURRENTLY

CREATE INDEX CONCURRENTLY IF NOT EXISTS "ActivityLog_user_id_created_at_idx" ON "ActivityLog"("user_id", "created_at" DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS "HabitLog_user_id_created_at_idx" ON "HabitLog"("user_id", "created_at" DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS "HydrationLog_user_id_created_at_idx" ON "HydrationLog"("user_id", "created_at" DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS "NutritionLog_user_id_created_at_idx" ON "NutritionLog"("user_id", "created_at" DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS "SleepLog_user_id_created_at_idx" ON "SleepLog"("user_id", "created_at" DESC);
