-- =============================================================================
-- Virtual Tour and Cultural Mapping App — database schema
-- Region IV-A (CALABARZON), Philippines
--
-- STRUCTURE ONLY. This file creates the tables, security policies and photo
-- bucket; it contains no destination data. The content — 26 destinations with
-- their photos and quizzes — lives in data/destinations-seed.json and is
-- loaded by scripts/seed-full-dataset.js.
--
-- Run both together with `npm run db:setup` (scripts/db-setup.js). Safe to
-- re-run: the RESET sections drop everything this file creates.
--
-- The `-- @section <name>` markers are read by scripts/db-setup.js so each
-- part runs (and reports) on its own. They are plain comments to Postgres.
-- =============================================================================


-- @section reset-tables
-- -----------------------------------------------------------------------------
-- RESET (1/2): tables, their policies/triggers/indexes, and helper functions
-- -----------------------------------------------------------------------------
drop table if exists public.ratings cascade;
drop table if exists public.favorites cascade;
drop table if exists public.destination_completions cascade;
drop table if exists public.quiz_attempts cascade;
drop table if exists public.quiz_options cascade;
drop table if exists public.quiz_questions cascade;
drop table if exists public.destination_images cascade;
drop table if exists public.destinations cascade;
drop function if exists public.set_updated_at() cascade;


-- @section reset-storage
-- -----------------------------------------------------------------------------
-- RESET (2/2): storage policies
-- -----------------------------------------------------------------------------
drop policy if exists "destination_images_anon_select" on storage.objects;
drop policy if exists "destination_images_anon_insert" on storage.objects;
drop policy if exists "destination_images_anon_update" on storage.objects;
drop policy if exists "destination_images_anon_delete" on storage.objects;

-- The bucket and its files are deliberately NOT deleted here. Supabase only
-- allows files to be removed through the Storage API, so the seed script
-- (scripts/seed-full-dataset.js) overwrites the photos it needs and removes
-- every other file. The storage section below creates or updates the bucket.


-- @section tables
-- -----------------------------------------------------------------------------
-- TABLES
-- -----------------------------------------------------------------------------

-- Phase 1: the destination catalogue (also carries Phase 2 tour text).
create table public.destinations (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  description           text not null,
  address               text not null,
  municipality          text,
  province              text not null
    check (province in ('Cavite', 'Laguna', 'Batangas', 'Rizal', 'Quezon')),
  category              text not null
    check (category in (
      'Historical Site',
      'Church & Religious',
      'Museum & Art',
      'Natural Wonder',
      'Heritage Town & Culture'
    )),
  latitude              double precision,
  longitude             double precision,
  history               text,
  cultural_significance text,
  cover_image_url       text,
  -- Run 8: Street View panorama within 250 m (null = not curated, e.g. added in the app)
  has_panorama          boolean,
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);

-- Phase 2: photo gallery for the virtual tour.
create table public.destination_images (
  id             uuid primary key default gen_random_uuid(),
  destination_id uuid not null references public.destinations (id) on delete cascade,
  image_url      text not null,
  caption        text,
  sort_order     integer not null default 0
);

-- Phase 2: per-destination multiple-choice quiz.
create table public.quiz_questions (
  id             uuid primary key default gen_random_uuid(),
  destination_id uuid not null references public.destinations (id) on delete cascade,
  question_text  text not null,
  sort_order     integer not null default 0,
  -- Run 6: 'curated' (the dataset) or 'auto' (generated in the app for a
  -- user-added destination). Added live by migrations/20261121_quiz_source.sql.
  source         text not null default 'curated' check (source in ('curated', 'auto'))
);

create table public.quiz_options (
  id          uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.quiz_questions (id) on delete cascade,
  option_text text not null,
  is_correct  boolean not null default false
);

-- Phase 2: progress tracking. `device_id` holds a generic "user key": the
-- Supabase auth user id for a signed-in user, or a random device UUID for a
-- guest (see src/context/IdentityContext.tsx).
create table public.quiz_attempts (
  id             uuid primary key default gen_random_uuid(),
  destination_id uuid not null references public.destinations (id) on delete cascade,
  device_id      text not null,
  score          integer not null,
  total          integer not null,
  taken_at       timestamptz default now()
);

create table public.destination_completions (
  id             uuid primary key default gen_random_uuid(),
  destination_id uuid not null references public.destinations (id) on delete cascade,
  device_id      text not null,
  completed_at   timestamptz default now(),
  unique (destination_id, device_id)
);

-- Run 4: saved ("hearted") destinations, keyed by the same user key.
-- Applied to an existing database without a reset by
-- supabase/migrations/20261118_favorites.sql (`npm run db:migrate`).
create table public.favorites (
  id             uuid primary key default gen_random_uuid(),
  destination_id uuid not null references public.destinations (id) on delete cascade,
  device_id      text not null,
  created_at     timestamptz default now(),
  unique (destination_id, device_id)
);

-- Run 6: one 1–5 star rating per destination per user key. Added live by
-- supabase/migrations/20261122_ratings.sql (`npm run db:migrate`).
create table public.ratings (
  id             uuid primary key default gen_random_uuid(),
  destination_id uuid not null references public.destinations (id) on delete cascade,
  device_id      text not null,
  stars          integer not null check (stars between 1 and 5),
  created_at     timestamptz default now(),
  updated_at     timestamptz default now(),
  unique (destination_id, device_id)
);

-- Indexes for the Explore filters and the foreign keys.
create index destinations_province_idx on public.destinations (province);
create index destinations_category_idx on public.destinations (category);
create index destinations_name_idx on public.destinations (lower(name));
create index destination_images_destination_idx
  on public.destination_images (destination_id, sort_order);
create index quiz_questions_destination_idx
  on public.quiz_questions (destination_id, sort_order);
create index quiz_options_question_idx on public.quiz_options (question_id);
create index quiz_attempts_device_idx on public.quiz_attempts (device_id, destination_id);
create index destination_completions_device_idx
  on public.destination_completions (device_id);
create index favorites_device_idx on public.favorites (device_id);
create index quiz_questions_source_idx on public.quiz_questions (destination_id, source);
create index ratings_device_idx on public.ratings (device_id);
create index ratings_destination_idx on public.ratings (destination_id);

-- Keep destinations.updated_at fresh on every edit.
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger destinations_set_updated_at
  before update on public.destinations
  for each row execute function public.set_updated_at();

create trigger ratings_set_updated_at
  before update on public.ratings
  for each row execute function public.set_updated_at();


-- @section rls
-- -----------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- School project, deliberately permissive. Guests use the publishable key as
-- the `anon` role; signed-in users (email + password) make the same requests
-- as the `authenticated` role. Both get the same full read/write access, so
-- signing in never removes a feature. (Policy names keep their original
-- `_anon_` suffix; scripts/lib/verify.js looks them up by name.)
--
-- PRODUCTION NOTE: in a real deployment the progress tables would be scoped
-- per user, e.g. for authenticated users
--   using (device_id = auth.uid()::text) with check (device_id = auth.uid()::text)
-- and guests would get a signed device token (or anonymous sign-in) instead
-- of a client-chosen key, and catalogue writes would be limited to editors.
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'destinations',
    'destination_images',
    'quiz_questions',
    'quiz_options',
    'quiz_attempts',
    'destination_completions',
    'favorites',
    'ratings'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('grant select, insert, update, delete on public.%I to anon, authenticated', t);

    execute format(
      'create policy %I on public.%I for select to anon, authenticated using (true)',
      t || '_anon_select', t);
    execute format(
      'create policy %I on public.%I for insert to anon, authenticated with check (true)',
      t || '_anon_insert', t);
    execute format(
      'create policy %I on public.%I for update to anon, authenticated using (true) with check (true)',
      t || '_anon_update', t);
    execute format(
      'create policy %I on public.%I for delete to anon, authenticated using (true)',
      t || '_anon_delete', t);
  end loop;
end $$;

-- Ask the Data API (PostgREST) to pick up the new tables immediately.
notify pgrst, 'reload schema';


-- @section storage
-- -----------------------------------------------------------------------------
-- STORAGE: public bucket for destination photos + read/write policies (guests and signed-in users)
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'destination-images',
  'destination-images',
  true,
  5242880, -- 5 MB per photo (the app resizes to 1600px before uploading)
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "destination_images_anon_select"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'destination-images');

create policy "destination_images_anon_insert"
  on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'destination-images');

create policy "destination_images_anon_update"
  on storage.objects for update to anon, authenticated
  using (bucket_id = 'destination-images')
  with check (bucket_id = 'destination-images');

create policy "destination_images_anon_delete"
  on storage.objects for delete to anon, authenticated
  using (bucket_id = 'destination-images');
