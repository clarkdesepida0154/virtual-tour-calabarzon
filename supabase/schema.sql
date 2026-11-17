-- =============================================================================
-- Virtual Tour and Cultural Mapping App — database schema
-- Region IV-A (CALABARZON), Philippines
--
-- Safe to re-run: the RESET sections drop everything this file creates.
-- Run it with `npm run db:setup` (scripts/db-setup.js) or paste the whole file
-- into the Supabase SQL editor.
--
-- The `-- @section <name>` markers are read by scripts/db-setup.js so each
-- part runs (and reports) on its own. They are plain comments to Postgres.
-- =============================================================================


-- @section reset-tables
-- -----------------------------------------------------------------------------
-- RESET (1/2): tables, their policies/triggers/indexes, and helper functions
-- -----------------------------------------------------------------------------
drop table if exists public.destination_completions cascade;
drop table if exists public.quiz_attempts cascade;
drop table if exists public.quiz_options cascade;
drop table if exists public.quiz_questions cascade;
drop table if exists public.destination_images cascade;
drop table if exists public.destinations cascade;
drop function if exists public.set_updated_at() cascade;


-- @section reset-storage
-- -----------------------------------------------------------------------------
-- RESET (2/2): storage policies and bucket entries
-- -----------------------------------------------------------------------------
drop policy if exists "destination_images_anon_select" on storage.objects;
drop policy if exists "destination_images_anon_insert" on storage.objects;
drop policy if exists "destination_images_anon_update" on storage.objects;
drop policy if exists "destination_images_anon_delete" on storage.objects;

-- Newer Supabase projects block direct deletes on storage tables (files must
-- be removed through the Storage API). When that guard is active we keep the
-- existing bucket; the storage section below is an upsert, so it still works.
do $$
begin
  delete from storage.objects where bucket_id = 'destination-images';
  delete from storage.buckets where id = 'destination-images';
exception when others then
  raise notice 'Bucket entries kept (direct storage deletes are blocked): %', sqlerrm;
end $$;


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
  sort_order     integer not null default 0
);

create table public.quiz_options (
  id          uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.quiz_questions (id) on delete cascade,
  option_text text not null,
  is_correct  boolean not null default false
);

-- Phase 2: progress tracking (no auth — keyed by an anonymous device id).
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


-- @section rls
-- -----------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- School project with no sign-in: the app's publishable key maps to the `anon`
-- role, which gets full read/write access through permissive policies.
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
    'destination_completions'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('grant select, insert, update, delete on public.%I to anon', t);

    execute format(
      'create policy %I on public.%I for select to anon using (true)',
      t || '_anon_select', t);
    execute format(
      'create policy %I on public.%I for insert to anon with check (true)',
      t || '_anon_insert', t);
    execute format(
      'create policy %I on public.%I for update to anon using (true) with check (true)',
      t || '_anon_update', t);
    execute format(
      'create policy %I on public.%I for delete to anon using (true)',
      t || '_anon_delete', t);
  end loop;
end $$;

-- Ask the Data API (PostgREST) to pick up the new tables immediately.
notify pgrst, 'reload schema';


-- @section storage
-- -----------------------------------------------------------------------------
-- STORAGE: public bucket for destination photos + anon read/write policies
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
  on storage.objects for select to anon
  using (bucket_id = 'destination-images');

create policy "destination_images_anon_insert"
  on storage.objects for insert to anon
  with check (bucket_id = 'destination-images');

create policy "destination_images_anon_update"
  on storage.objects for update to anon
  using (bucket_id = 'destination-images')
  with check (bucket_id = 'destination-images');

create policy "destination_images_anon_delete"
  on storage.objects for delete to anon
  using (bucket_id = 'destination-images');


-- @section seed
-- -----------------------------------------------------------------------------
-- SEED DATA (temporary)
-- Six sample destinations with placeholder cover photos. This whole section is
-- self-contained: replace it with the full 25-destination dataset later
-- without touching anything above.
--
-- The picsum.photos seeds are stand-ins, NOT photos of the real places. Each
-- seed was checked by eye to be a neutral landscape/building; real photos
-- replace them together with the full dataset.
-- -----------------------------------------------------------------------------
insert into public.destinations
  (name, description, address, municipality, province, category,
   latitude, longitude, history, cultural_significance, cover_image_url)
values
  (
    'Rizal Shrine',
    'A faithful reconstruction of the Spanish-colonial bahay na bato where Dr. José Rizal, the Philippine national hero, was born on June 19, 1861. Now a museum run by the National Historical Commission of the Philippines, its rooms display family memorabilia, period furniture, and copies of Rizal''s writings and sketches.',
    'Francisco Mercado St. cor. Jose P. Rizal St., Brgy. 5 (Poblacion), Calamba City, Laguna 4027',
    'Calamba',
    'Laguna',
    'Historical Site',
    14.2136, 121.1669,
    'The original Mercado–Rizal house was built in the 1800s and fell into ruin after the family was evicted from Calamba in the 1890s. The government acquired the lot, and the house was rebuilt under architect Juan F. Nakpil and inaugurated in 1950, funded largely by contributions from Filipino schoolchildren.',
    'As the birthplace of the national hero, the shrine is one of the most visited historical sites in the country and a traditional stop for student field trips. It anchors Calamba''s identity as the "Hometown of Rizal" and is the focus of yearly Rizal Day and birth anniversary rites.',
    'https://picsum.photos/seed/rizal-shrine/1200/800'
  ),
  (
    'Basilica of St. Martin de Tours',
    'Better known as Taal Basilica, this hilltop church is widely regarded as the largest Catholic church in the Philippines and in Asia, measuring about 88 meters long and 48 meters wide. Its grand Baroque façade and silver tabernacle preside over the heritage town of Taal.',
    'Calle San Martin, Poblacion, Taal, Batangas 4208',
    'Taal',
    'Batangas',
    'Church & Religious',
    13.8802, 120.9235,
    'Augustinian missionaries founded the parish in the 1570s near the shore of Taal Lake, but the old town was destroyed by the 1754 eruption of Taal Volcano and moved to its present site. Construction of the current church began in 1856 under Spanish architect Luciano Oliver, and it was declared a minor basilica in 1954.',
    'The basilica is the centerpiece of the Taal Heritage Town, one of the best-preserved Spanish-colonial townscapes in the country. It remains an active pilgrimage church dedicated to St. Martin of Tours, the town''s patron saint, whose feast is celebrated every November 11.',
    'https://picsum.photos/seed/taal-church/1200/800'
  ),
  (
    'Aguinaldo Shrine',
    'The ancestral mansion of General Emilio Aguinaldo, first President of the Philippines, where Philippine independence from Spain was proclaimed on June 12, 1898. The house is now a national shrine and museum, famous for its independence balcony, secret passages, and Aguinaldo''s tomb in the garden.',
    'Tirona Highway, Brgy. Kaingen, Kawit, Cavite 4104',
    'Kawit',
    'Cavite',
    'Historical Site',
    14.4449, 120.9068,
    'The house was first built in 1845 and later expanded by Aguinaldo himself into the mansion seen today. From its window the Philippine flag was formally unfurled and the national anthem played during the 1898 proclamation. Aguinaldo donated the house to the Filipino people in 1963, and it was declared a national shrine in 1964.',
    'Regarded as the birthplace of Philippine independence, the shrine is the focal point of Independence Day ceremonies in Cavite every June 12. It embodies the province''s role as the cradle of the Philippine Revolution.',
    'https://picsum.photos/seed/aguinaldo-shrine/1200/800'
  ),
  (
    'Pagsanjan Falls',
    'One of the most famous waterfalls in the Philippines, also known by its indigenous name Magdapio Falls and as Cavinti Falls. Visitors reach it by "shooting the rapids" — a dugout-canoe ride through a dramatic gorge of the Bumbungan River steered by skilled local boatmen.',
    'Pagsanjan Gorge National Park, Cavinti, Laguna 4013 (boat rides depart from Pagsanjan town)',
    'Cavinti',
    'Laguna',
    'Natural Wonder',
    14.2625, 121.4996,
    'The gorge and falls were declared the Pagsanjan Gorge National Park in 1939. River trips from the town of Pagsanjan have drawn travelers since the Spanish and American colonial periods, making it one of the country''s oldest tourist attractions.',
    'The boatmen''s craft of paddling and hauling canoes upstream through the rapids is a local tradition passed down through generations. The falls are central to the tourism identity of both Pagsanjan and Cavinti.',
    'https://picsum.photos/seed/falls/1200/800'
  ),
  (
    'Angono Petroglyphs',
    'The oldest known work of art in the Philippines: 127 human and animal figures engraved on the wall of a shallow rock shelter, dating back to the late Neolithic period. The site is managed by the National Museum of the Philippines, with a small museum and viewing deck.',
    'Angono–Binangonan Petroglyphs Site Museum, Binangonan, Rizal 1940',
    'Binangonan',
    'Rizal',
    'Museum & Art',
    14.5328, 121.1868,
    'The engravings were rediscovered in 1965 by National Artist Carlos "Botong" Francisco during a field trip with boy scouts. Archaeological work that followed recovered stone tools and earthenware fragments, and the site was declared a National Cultural Treasure in 1973.',
    'The petroglyphs are a rare window into the beliefs of the islands'' early inhabitants and are believed to have been carved as part of healing or ritual practices. The site is on the Philippines'' tentative list for UNESCO World Heritage inscription.',
    'https://picsum.photos/seed/angono/1200/800'
  ),
  (
    'Villa Escudero',
    'A working coconut plantation and heritage resort founded by the Escudero family in the 19th century and opened to the public in 1981. Guests ride carabao-drawn carts, tour a museum of colonial religious art and antiques, and dine barefoot at the foot of the Labasin Falls spillway.',
    'Km. 91 Maharlika Highway, Tiaong, Quezon 4325',
    'Tiaong',
    'Quezon',
    'Heritage Town & Culture',
    14.0002, 121.3349,
    'The hacienda was established in the 1870s by Don Plácido Escudero and Doña Claudia Marasigan as a sugarcane estate, later converted to coconut by their son Don Arsenio Escudero. Arsenio also built the Labasin Dam, a hydroelectric plant that powered the plantation''s coconut factory.',
    'Villa Escudero is a living showcase of Southern Tagalog plantation life, from folk dance and music performed by the estate''s own community to traditional bahay kubo architecture. Its private museum holds one of the country''s notable collections of religious art and heirlooms.',
    'https://picsum.photos/seed/villa-escudero/1200/800'
  );
