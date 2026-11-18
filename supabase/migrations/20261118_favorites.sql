-- =============================================================================
-- Migration (Run 4): favorites
--
-- Adds the `favorites` table to an EXISTING database without touching any
-- other table or row. Idempotent: safe to run any number of times.
-- `supabase/schema.sql` creates the same table on a fresh reset.
--
-- Apply with `npm run db:migrate` (scripts/db-migrate.js), which runs every
-- file in supabase/migrations/ in name order, each in one transaction.
-- =============================================================================

create table if not exists public.favorites (
  id             uuid primary key default gen_random_uuid(),
  destination_id uuid not null references public.destinations (id) on delete cascade,
  device_id      text not null,
  created_at     timestamptz default now(),
  unique (destination_id, device_id)
);

create index if not exists favorites_device_idx on public.favorites (device_id);

-- Same deliberately permissive access as every other table (see schema.sql):
-- guests (`anon`) and signed-in users (`authenticated`) may read and write.
alter table public.favorites enable row level security;
grant select, insert, update, delete on public.favorites to anon, authenticated;

drop policy if exists favorites_anon_select on public.favorites;
drop policy if exists favorites_anon_insert on public.favorites;
drop policy if exists favorites_anon_update on public.favorites;
drop policy if exists favorites_anon_delete on public.favorites;

create policy favorites_anon_select on public.favorites
  for select to anon, authenticated using (true);
create policy favorites_anon_insert on public.favorites
  for insert to anon, authenticated with check (true);
create policy favorites_anon_update on public.favorites
  for update to anon, authenticated using (true) with check (true);
create policy favorites_anon_delete on public.favorites
  for delete to anon, authenticated using (true);

-- Ask the Data API (PostgREST) to pick up the new table immediately.
notify pgrst, 'reload schema';
