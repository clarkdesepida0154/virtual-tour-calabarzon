-- =============================================================================
-- Migration (Run 6): quiz_questions.source
--
-- Marks where a quiz question came from:
--   'curated' — written by hand for the dataset (data/destinations-seed.json);
--   'auto'    — generated in the app from a user-added destination's own
--               fields (src/lib/quizGenerator.ts).
-- Every existing row becomes 'curated' through the default. Idempotent: safe
-- to run any number of times. `supabase/schema.sql` creates the same column
-- on a fresh reset. Apply with `npm run db:migrate`.
-- =============================================================================

alter table public.quiz_questions
  add column if not exists source text not null default 'curated';

alter table public.quiz_questions
  drop constraint if exists quiz_questions_source_check;
alter table public.quiz_questions
  add constraint quiz_questions_source_check check (source in ('curated', 'auto'));

create index if not exists quiz_questions_source_idx
  on public.quiz_questions (destination_id, source);

notify pgrst, 'reload schema';
