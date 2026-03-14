-- Drop the old constraint
ALTER TABLE public.test_results DROP CONSTRAINT IF EXISTS test_results_test_type_check;

-- Add the new constraint with 'sarc-f' and 'energy' included
ALTER TABLE public.test_results ADD CONSTRAINT test_results_test_type_check 
CHECK (test_type IN ('bio-age', 'score', 'circadian', 'insomnia', 'mini-cog', 'RU-AUDIT', 'nicotine', 'energy', 'sarc-f'));
