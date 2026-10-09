-- Add 'functional-reserve' (Functional Reserve Profile calculator) to allowed test types
ALTER TABLE public.test_results DROP CONSTRAINT IF EXISTS test_results_test_type_check;

ALTER TABLE public.test_results ADD CONSTRAINT test_results_test_type_check
CHECK (test_type IN ('bio-age', 'score', 'circadian', 'insomnia', 'mini-cog', 'RU-AUDIT', 'nicotine', 'energy', 'sarc-f', 'ipss', 'mief-5', 'greene-scale', 'systemic-bio-age', 'water', 'functional-reserve'));
