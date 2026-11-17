# Virtual Tour and Cultural Mapping App

@AGENTS.md

Context for future runs. Read this first; it is the source of truth for what
the project is, what is decided, and what is left.

## Project

A mobile app for exploring the MAJOR tourist destinations and cultural heritage
sites of **Region IV-A (CALABARZON), Philippines** (Cavite, Laguna, Batangas,
Rizal, Quezon), as an alternative to educational field trips.

- University subject: **WMA 306 — UI/UX and Cross-Platform Applications**.
  UI/UX is graded, so polish is the point.
- Presentation tone: museum-quality and educational (inspiration: the National
  Museum of Fine Arts).
- Test device: an Android phone running **Expo Go**.
- Location on disk: `C:\Clark's Folder\4th-yr_1st-sem\WMA 306 - Mr. Matute\virtual-tour-app`.
  The path has an apostrophe and spaces. Metro, npm, tsc and git all work with
  it as-is. If a tool ever chokes on it, create a junction
  (`mklink /J C:\dev\vtour "<that path>"`) and work through the junction — the
  folder itself must stay where it is.

## Feature spec

### Phase 1 — built

1. **Destination CRUD** — add, view, edit, delete.
2. **Destination info** — name, description, address, category, image.
3. **Search** by name + **filter** by category AND by province (combinable).
4. **Navigation** — Home → Explore list → Details (+ Add / Edit).
5. **Database** — Supabase (Postgres + Storage).

Screens:

- **Home** — app name + tagline hero, search bar (submitting jumps to Explore
  with the query), "Featured" horizontal carousel, category grid and province
  shortcuts (tap → pre-filtered Explore).
- **Explore** — search-as-you-type (`ilike` on name and municipality),
  combinable single-select chips for category + province, destination cards
  (cover, name, municipality • province, category tag), pull-to-refresh.
- **Details** — full-width cover, name, address row, category + province tags,
  description; History and Cultural Significance sections render only when
  those fields have content; Edit, and Delete with a confirmation dialog.
- **Add / Edit** — one shared form (`DestinationForm`): validation (name,
  description, address, province, category required), dropdowns for category
  and province, optional numeric lat/long, photo picker → resize to max 1600px
  → upload to the storage bucket with staged progress → save the public URL.

### Phase 2 — screens not built (the schema and the content are ready)

- **Virtual tour content** — history, cultural significance, photo gallery
  (`destinations.history`, `destinations.cultural_significance`,
  `destination_images`).
- **Per-destination multiple-choice quizzes** with auto-scoring
  (`quiz_questions`, `quiz_options`).
- **Progress tracking** — quiz scores and completed destinations, keyed by an
  anonymous device id (`quiz_attempts`, `destination_completions`).

## Fixed stack — do not substitute

- Latest Expo SDK (currently **58**; React Native 0.88, React 19.3) +
  **TypeScript strict**, scaffolded with create-expo-app.
- **Expo Router** — bottom tabs (Home / Explore / Add) inside a root stack that
  also holds Details and Edit. Typed routes and the React Compiler are on.
- **react-native-paper** (Material Design 3) with the custom theme below.
- **@supabase/supabase-js** for all data.
- **expo-image** for all image rendering; **expo-image-picker** +
  **expo-image-manipulator** for uploads.
- **No Redux** — hooks + lightweight context only.

## Design system

Heritage-museum aesthetic. Light theme only. Everything lives in
`src/theme/index.ts` and is consumed everywhere — **zero ad-hoc colours or font
sizes inside screens or components**.

| Token | Value |
| --- | --- |
| primary (terracotta) | `#9A3B26` |
| secondary (heritage gold) | `#C9A227` |
| background (warm cream) | `#FAF6EF` |
| surface | `#FFFFFF` |
| ink (text) | `#2A2420` |
| success (forest) | `#2F5D46` |
| muted | `#8A8178` |

The theme derives a few extra shades from these (soft tints for containers,
`secondaryDark` for gold text that must stay readable on cream, outlines,
photo scrims). Add new shades there, never inline.

- **Typography** — Playfair Display (`@expo-google-fonts/playfair-display`) for
  screen titles and destination names; Inter (`@expo-google-fonts/inter`) for
  body. Use `<AppText variant="…">`; variants are defined in `typography`.
- **Spacing** — 4/8pt scale: `spacing.xs` 4 … `spacing.huge` 64.
- **Shape** — 12px card radius (`radius.md`), soft warm shadows
  (`elevation.card` / `raised`).
- **Every screen** has a loading state (skeletons or spinner), a friendly empty
  state, and an error state with retry (`StateViews.tsx`, `Skeleton.tsx`).
- **Icons** — Material Community Icons through `<AppIcon>` (token sizes and
  colours).
- **Accessibility** — touch targets ≥ 48dp, labels and roles on pressables,
  font scaling capped at 1.3×.

## Database

Two files together define everything in the database:

- `supabase/schema.sql` — **structure only**: tables, RLS, the storage bucket.
  Re-runnable; it starts with a RESET section. It contains no destination data.
- `data/destinations-seed.json` — **the content**: the 26 destinations, their
  photos and their quizzes. This is the single source of truth for content.

| Table | Purpose |
| --- | --- |
| `destinations` | The catalogue. `id`, `name`, `description`, `address`, `municipality`, `province` (CHECK: the 5 provinces), `category` (CHECK: the 5 categories), `latitude`, `longitude`, `history`, `cultural_significance`, `cover_image_url`, `created_at`, `updated_at` (kept fresh by a trigger). |
| `destination_images` | A destination's photos in order: `destination_id` → cascade, `image_url`, `caption`, `sort_order`. **Row 0 is the cover** (same URL as `destinations.cover_image_url`), rows 1–2 are the gallery. `caption` holds the photo credit. |
| `quiz_questions` | `destination_id` → cascade, `question_text`, `sort_order` (1–5). |
| `quiz_options` | `question_id` → cascade, `option_text`, `is_correct`. There is **no order column** — shuffle options in the app when showing a quiz. |
| `quiz_attempts` | `destination_id` → cascade, `device_id`, `score`, `total`, `taken_at`. |
| `destination_completions` | `destination_id` → cascade, `device_id`, `completed_at`, unique `(destination_id, device_id)`. |

- **Categories**: Historical Site · Church & Religious · Museum & Art ·
  Natural Wonder · Heritage Town & Culture.
- **Provinces**: Cavite · Laguna · Batangas · Rizal · Quezon.
  Both lists also live in `src/constants/taxonomy.ts` and `scripts/lib/dataset.js`
  — change all three together.
- **RLS** is on for every table, with permissive `anon` policies for
  select/insert/update/delete plus explicit grants. There is no sign-in; the
  publishable key maps to the `anon` role.
- **Storage** — public bucket `destination-images` (5 MB limit, JPEG/PNG/WebP),
  with `anon` read/write policies.
  - Dataset photos: `<slug>/cover.jpg`, `<slug>/gallery-1.jpg`, `<slug>/gallery-2.jpg`.
    Their public URLs carry a `?v=<content hash>` so a replaced photo is never
    served from a stale cache.
  - Photos picked in the app: `covers/<timestamp>-<random>.jpg`.
- **Ids are stable.** Seeded rows get deterministic UUIDs derived from the slug
  (`stableId()` in `scripts/lib/dataset.js`), so re-seeding keeps every id.

## Content dataset

`data/destinations-seed.json` holds, for each of the 26 destinations: `slug`,
`name`, `category`, `province`, `municipality`, `address`, `latitude`,
`longitude`, `description` (2–3 sentences), `history` (120–200 words),
`cultural_significance` (80–150 words), `images` (cover + 2 gallery), `quiz`
(5 questions × 4 options, exactly one correct), plus `sources`, `caveats`
and `coordinate_source` recording how it was verified.

The list is fixed — 5 Cavite, 6 Laguna, 5 Batangas, 5 Rizal, 5 Quezon:

- **Cavite**: Aguinaldo Shrine · Corregidor Island · Bonifacio Trial House ·
  Imus Cathedral · Tagaytay Ridge–Taal Volcano Viewpoint
- **Laguna**: Rizal Shrine · Pagsanjan Falls · Nagcarlan Underground Cemetery ·
  Pila Heritage Town · Paete Woodcarving Town & St. James the Apostle Church ·
  Mount Makiling
- **Batangas**: Taal Heritage Town & Basilica of St. Martin de Tours ·
  Taal Volcano & Lake · Apolinario Mabini Shrine · Caleruega Church ·
  Anilao Diving & Marine Sanctuary
- **Rizal**: Angono Petroglyphs · Masungi Georeserve · Antipolo Cathedral ·
  Pinto Art Museum · Daranak Falls
- **Quezon**: Villa Escudero Plantations · Kamay ni Hesus Shrine ·
  Malagonlong Bridge · Minor Basilica of St. Michael the Archangel ·
  Lucban Heritage Town & Pahiyas Festival

Rules for editing content:

- **Accuracy first.** Every date, name and number was checked against Wikipedia
  plus an official / heritage source where one exists. Contested claims are
  attributed ("often cited as…") and logged in that entry's `caveats`. Keep it
  that way: never add an unverified fact, and record what you softened.
- **Tone**: museum label — neutral, educational, no marketing language.
- **Quizzes must be answerable from the destination's own text** (description +
  history + cultural significance). Each question keeps an `evidence` sentence
  quoted from that text. If you edit a text, re-check its questions.
- **Photos come from Wikimedia Commons only**, under public domain, CC0, CC BY
  or CC BY-SA. The credit is stored exactly as
  `Photo: <author>, <license>, via Wikimedia Commons`. Processed files live in
  `data/images/<slug>/` (committed, ≤1600px, roughly 150–400 KB) and
  `data/IMAGE_CREDITS.md` lists every author and licence (generated).
  Never use an image from any other site.
- Look at a photo before using it: Commons categories contain miscategorized
  files (the "Rizal Shrine (Calamba)" search returns Fort Santiago shots).
- After any change run `npm run data:check`, then `npm run db:seed`.

### Supabase keys

This project uses Supabase's **new API key system**. The **publishable** key
(`sb_publishable_…`) plays the role of the old anon key and is safe in the app.
The secret key is never used anywhere.

`.env` (git-ignored; `.env.example` has the same names with blank values):

```
EXPO_PUBLIC_SUPABASE_URL=…
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=…
SUPABASE_DB_URL=…
```

Only the `EXPO_PUBLIC_` variables may be read by app code. `SUPABASE_DB_URL`
is for setup scripts ONLY — never import it anywhere in the app. It currently
points at the `aws-0-ap-southeast-1` session pooler (port 5432), which works;
the direct host is IPv6-only and does not.

### Scripts

| Command | What it does |
| --- | --- |
| `npm run db:setup` | **Full reset.** Runs `schema.sql` (drop + create), then seeds the real 26-destination dataset, then verifies. |
| `npm run db:seed` | Re-seeds the dataset only (`scripts/seed-full-dataset.js`): uploads the photos, then in one transaction deletes every destination and inserts the 26, then removes unused files from the bucket. Idempotent. |
| `npm run db:verify` | Read-only check: 6 tables with RLS, exactly the 26 dataset destinations, each with a cover, 3 photo rows and 5 sound questions, no placeholder URLs, 5 random photo links return 200. |
| `npm run db:test` | `scripts/verify-crud.mjs` (via `tsx`): exercises the app's real repositories against the live project with the publishable key — reads, search + filters, Featured selection, quiz and photo rows, upload, create / update / delete. Cleans up after itself. |
| `npm run data:check` | Offline validation of the JSON, including "every quiz answer is in the text". |
| `npm run images:fetch` | Downloads + processes photos named in the JSON that are missing from `data/images` (`-- --force` to redo). |
| `npm run images:find` | Curation helper: contact sheet of usable Commons photos for a category / search. |

How `db:setup` connects: `scripts/lib/db.js` tries `SUPABASE_DB_URL` first and
only if that fails walks the fallbacks (direct host, then the `aws-1` / `aws-0`
session poolers, then the transaction pooler), saving the first that works
back to `.env`. No password is hardcoded.

**There are no placeholder seeds any more.** `db:setup` and `db:seed` are both
destructive — destinations added from the app and all quiz / progress rows are
removed — but they always end with the real dataset. No script may regress the
database to sample data.

### Downloading from Wikimedia Commons — read before fetching photos

A misdiagnosed block cost hours in Run 2. What is actually true (built into `scripts/lib/commons.js`):

- **Use the API's `thumburl` verbatim.** It points at `thumb.wikimedia.org` and downloads fine for scripts.
- **`upload.wikimedia.org` always answers scripts with HTTP 429** — originals and any hand-built thumbnail path. It is not a temporary rate limit; waiting does not help. Never build rendition URLs yourself.
- If an original is narrower than the requested width the API returns the original URL (429). `resolveRenditions()` re-queries at narrower standard widths (1280, 960) to get a thumb URL.
- Pace downloads (~3 s apart); `download()` throws `CommonsThrottledError` on a 429 and does not retry.
- Use a generic User-Agent; never put personal contact details in it. Fetch from Commons only.
- `data/images` is committed, so seeding never needs Commons.

## Conventions

- **Strict TypeScript.** `npx tsc --noEmit` and `npx expo lint` must both pass
  before a task is done.
- **Repository pattern.** Screens and components never call supabase-js.
  - `src/lib/supabase.ts` — the one client.
  - `src/repositories/destinations.ts`, `destinationImages.ts` — factories that
    take a client, so Node scripts can reuse them. Keep them (and
    `src/lib/destinationForm.ts`, `featured.ts`, `base64.ts`, `errors.ts`,
    `src/constants/taxonomy.ts`) free of React Native imports.
  - `src/repositories/index.ts` — binds the factories to the app client.
    Import repositories from `@/repositories`.
- **Lists use summaries.** `destinationsRepository.list()` returns
  `DestinationSummary` rows (id, name, municipality, province, category, cover)
  — never the long texts. Only `getById()` loads a full `Destination`. Cards
  take a `DestinationSummary`.
- **Featured is derived, not stored.** There is no "featured" column.
  `pickFeatured()` in `src/lib/featured.ts` picks six destinations that cover
  every province and mix categories, rotating once a day. Do not hardcode
  destination names or ids anywhere in the app.
- **Photos have two records.** `destinations.cover_image_url` is what cards and
  the Details cover show; `destination_images` lists all of a destination's
  photos (row 0 = the cover) with their credit lines. When a cover is replaced
  or a destination deleted, the form / Details screen cleans up both the files
  and the rows — keep that in step if you touch either.
- **Photo credits are shown** on the Details screen (required by the photo
  licences). Any new screen that shows a gallery photo large must show its
  `caption` too.
- **Handwritten table types** in `src/types/database.ts` (`type` aliases, not
  interfaces — supabase-js needs them assignable to `Record<string, unknown>`).
- **Reads go through hooks** (`src/hooks/useDestinations.ts`, built on
  `useAsyncData`): they give `status` (`loading` / `error` / `success`),
  `retry`, `refresh`, and refetch automatically after any write.
- **After any write**, call `notifyChanged()` from `DataSyncContext` so every
  mounted screen reloads.
- **Errors** are wrapped in `AppError` (`src/lib/errors.ts`) with a
  plain-language message; show them with `<ErrorState>` or a toast.
- **State** — `ExploreFiltersContext` (search + filters, shared by Home and
  Explore), `DataSyncContext`, `ToastContext`. Nothing heavier.
- **Imports** use the `@/` alias for `src/`.

Folder layout:

```
src/
  app/                 Expo Router routes only
    _layout.tsx        Fonts, providers, root stack
    (tabs)/            _layout (tab bar), index (Home), explore, add
    destination/[id]/  index (Details), edit
  components/          Shared UI; components/form/ holds the form pieces
  constants/           taxonomy.ts
  context/             The three lightweight contexts
  hooks/               useAsyncData, useDestinations, useDebouncedValue
  lib/                 supabase, errors, destinationForm, featured, coverPhoto, base64, format
  repositories/        Data access
  theme/               Design tokens + Paper and navigation themes
  types/               database.ts
data/
  destinations-seed.json   The content (single source of truth)
  images/<slug>/           cover.jpg, gallery-1.jpg, gallery-2.jpg (committed)
  IMAGE_CREDITS.md         Generated list of photo authors and licences
supabase/schema.sql    Structure only
scripts/
  db-setup.js              schema + seed + verify
  seed-full-dataset.js     the seeder
  verify-crud.mjs          live data-layer tests (db:test)
  check-dataset.js         offline dataset validation (data:check)
  fetch-images.js          download + process photos
  find-commons-images.js   photo curation helper
  lib/                     env, db, dataset, images, commons, verify
assets/                Icons, splash emblem (sources in assets/brand)
```

### Things learned the hard way (SDK 58 / RN 0.88)

- Refs are typed with `ComponentRef<typeof View>` / `ComponentRef<typeof ScrollView>`;
  `View` is no longer a usable ref type.
- `StyleSheet.absoluteFillObject` is gone — spread `StyleSheet.absoluteFill`.
- Do not import from `@react-navigation/*`. Hooks such as `useIsFocused` and
  `ThemeProvider` come from `expo-router`.
- The React Compiler lint rules reject reading or passing refs during render.
  Register refs through a callback prop (see `FieldAnchor` in `DestinationForm`).
- Paper's `ProgressBar` stretches to 100% height on web — always use
  `<LinearProgress>`, which boxes it.
- A Paper `TextInput.Icon` is a button; do not put one inside a `Pressable`.
- Android is edge-to-edge, so the window does not resize for the keyboard:
  forms use `KeyboardAvoidingView behavior="padding"` plus the measure-and-scroll
  logic in `DestinationForm`.
- Photos are uploaded as an `ArrayBuffer` decoded from the manipulator's Base64
  output (`src/lib/base64.ts`) — no extra native module.
- Tabs stay mounted. Only the focused screen should render a `<StatusBar>`
  (guard it with `useIsFocused()`).
- `sharp` is a devDependency used only by the Node scripts. Never import it
  (or anything under `scripts/`) from `src/`.

## Rules

- **Stay Expo Go compatible.** No native modules or config plugins that need a
  development build. Before adding a library, confirm it ships in Expo Go.
- **Never hardcode secrets.** Keys come from `.env`; `.env` is never committed.
- **Content lives in `data/destinations-seed.json`.** Nothing in the app may
  depend on a specific destination; never reintroduce sample / placeholder data
  into `schema.sql` or any script.
- **Photos: Wikimedia Commons only**, freely licensed, always credited.
- Install packages with `npx expo install <package>`.
- Commit at each milestone with a descriptive message.

## Roadmap

Phase 1

- [x] Project scaffold: Expo SDK 58, TypeScript strict, Expo Router tabs + stack
- [x] Design system: tokens, Paper MD3 theme, Playfair Display + Inter
- [x] Supabase schema, RLS, storage bucket, automated `db:setup`
- [x] Typed repositories + live verification script (`db:test`)
- [x] Home: hero, search, featured carousel, category grid, province shortcuts
- [x] Explore: search-as-you-type, combinable category + province filters, pull-to-refresh
- [x] Details: cover, info, conditional History / Cultural Significance, edit, delete with confirmation
- [x] Add / Edit: shared validated form, dropdowns, coordinates, photo pick → resize → upload
- [x] Loading, empty and error states on every screen
- [x] App icon and splash emblem
- [x] README with run instructions

Content (Run 2)

- [x] Full dataset: 26 destinations with verified description, history, cultural significance, address and coordinates
- [x] Real photos: 78 freely licensed Wikimedia Commons images (cover + 2 gallery each), processed, credited and committed in data/images
- [x] Quiz bank: 130 questions (5 per destination), each answerable from the destination's own text
- [x] `db:setup` / `db:seed` load the real dataset; placeholder seeds retired for good
- [x] Lists load light summaries; Featured picks a varied, daily-rotating set
- [x] Photo credit shown on the Details screen

Next

- [ ] Virtual Tour mode (history, cultural significance, photo gallery from `destination_images`, with captions)
- [ ] Quiz engine (per-destination multiple choice, auto-scoring; shuffle the options)
- [ ] Progress tracking (quiz scores + completed destinations, by device id)
- [ ] Google Maps (`react-native-maps`) using the stored coordinates
- [ ] Final polish + EAS APK

## Not yet verified on a device

The app was checked with `tsc`, ESLint, an Android Metro bundle, the live
database scripts, and a click-through in the web build. It has **not** been run
on a physical Android phone by the agent. The parts that only a phone can
confirm: the photo picker and upload, keyboard avoidance in the form, and
status-bar / navigation-bar insets.
