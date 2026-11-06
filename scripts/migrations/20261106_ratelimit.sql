-- Migration: RateLimit table with RLS and revoked anon/authenticated access
-- Date: 2026-11-06
-- Description: Rate limiting table for public and sensitive endpoints (email sending, AI reports, contact forms)

CREATE TABLE IF NOT EXISTS public."RateLimit" (
    key VARCHAR(64) PRIMARY KEY,
    count INTEGER NOT NULL DEFAULT 1,
    window_start TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ratelimit_expires_at ON public."RateLimit" (expires_at);

-- Enable RLS
ALTER TABLE public."RateLimit" ENABLE ROW LEVEL SECURITY;

-- Revoke all access from anon and authenticated roles (only service_role / postgres can access)
REVOKE ALL ON TABLE public."RateLimit" FROM anon, authenticated;
GRANT ALL ON TABLE public."RateLimit" TO service_role;

