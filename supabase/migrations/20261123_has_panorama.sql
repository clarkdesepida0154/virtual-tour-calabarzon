-- =============================================================================
-- Migration (Run 8): destinations.has_panorama
--
-- Whether Google Street View has a panorama within 250 m of the destination,
-- found at build time by scripts/curate-panoramas.mjs (Maps Embed API in
-- headless Chromium) and stored in data/destinations-seed.json:
--   true  — curated, a panorama exists → the tour shows its 360° View step;
--   false — curated, no imagery        → the step is left out;
--   null  — not curated (added in the app) → the step is shown optimistically.
-- Nullable with no default, so existing rows (and rows the app inserts) start
-- as null. Idempotent. `supabase/schema.sql` creates the same column on a
-- fresh reset. Apply with `npm run db:migrate`, then copy the dataset's flags
-- with `npm run db:sync-panoramas` (no reset).
-- =============================================================================

alter table public.destinations
  add column if not exists has_panorama boolean;

comment on column public.destinations.has_panorama is
  'Street View panorama within 250 m (Run 8 curation). null = not curated.';

notify pgrst, 'reload schema';
