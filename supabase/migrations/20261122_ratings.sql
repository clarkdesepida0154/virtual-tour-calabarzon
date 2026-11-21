-- =============================================================================
-- Migration (Run 6): ratings
--
-- One 1–5 star rating per destination per user key (`device_id`: the auth
-- user id when signed in, the device UUID for a guest — the same key as the
-- progress tables). Re-rating updates the row (upsert on the unique pair).
-- Idempotent: safe to run any number of times. `supabase/schema.sql`
-- creates the same table on a fresh reset. Apply with `npm run db:migrate`.
-- =============================================================================

create table if not exists public.ratings (
  id             uuid primary key default gen_random_uuid(),
  destination_id uuid not null references public.destinations (id) on delete cascade,
  device_id      text not null,
  stars          integer not null check (stars between 1 and 5),
  created_at     timestamptz default now(),
  updated_at     timestamptz default now(),
  unique (destination_id, device_id)
);

create index if not exists ratings_device_idx on public.ratings (device_id);
create index if not exists ratings_destination_idx on public.ratings (destination_id);

-- Keep updated_at fresh when a rating is changed (function from schema.sql).
drop trigger if exists ratings_set_updated_at on public.ratings;
create trigger ratings_set_updated_at
  before update on public.ratings
  for each row execute function public.set_updated_at();

-- Same deliberately permissive access as every other table (see schema.sql).
alter table public.ratings enable row level security;
grant select, insert, update, delete on public.ratings to anon, authenticated;

drop policy if exists ratings_anon_select on public.ratings;
drop policy if exists ratings_anon_insert on public.ratings;
drop policy if exists ratings_anon_update on public.ratings;
drop policy if exists ratings_anon_delete on public.ratings;

create policy ratings_anon_select on public.ratings
  for select to anon, authenticated using (true);
create policy ratings_anon_insert on public.ratings
  for insert to anon, authenticated with check (true);
create policy ratings_anon_update on public.ratings
  for update to anon, authenticated using (true) with check (true);
create policy ratings_anon_delete on public.ratings
  for delete to anon, authenticated using (true);

notify pgrst, 'reload schema';
