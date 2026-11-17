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
  (cover, name, municipality • province, category tag), pull-to-refresh, and
  an **Add** floating action button (bottom right) that opens the Add form.
- **Details** — full-width cover, name, category + province tags, Visited and
  best-quiz-score badges (when earned), address row, description, a dark
  "Virtual tour" invitation card, a small map preview card (tap → Map tab
  centred there), History and Cultural Significance sections (only when they
  have content), the cover's photo credit, and a "Manage this entry" section
  with Edit and Delete (confirmation dialog). The bottom bar holds **Start
  Virtual Tour** (primary) and **Quiz** (shows the best score once taken).
- **Add / Edit** — one shared form (`DestinationForm`): validation (name,
  description, address, province, category required), dropdowns for category
  and province, optional numeric lat/long, photo picker → resize to max 1600px
  → upload to the storage bucket with staged progress → save the public URL.
  Add is a root-stack screen (`src/app/add.tsx`) since Run 3.

### Phase 2 — built (Run 3)

1. **Virtual Tour** (`destination/[id]/tour`) — full-screen, tab bar hidden,
   close button, step indicator. Guided sequence: **Intro** (cover photo,
   name, category, municipality • province, description, credit) →
   **Gallery** (all `destination_images` rows, swipeable, page dots, arrow
   buttons, credit line from each row's `caption`) → **History** (Chapter I)
   → **Cultural Significance** (Chapter II) → **Completion** ("Mark as
   Visited" writes `destination_completions`, idempotent per user key; then
   "Take the Quiz"). Intro and gallery sit on a dark "gallery wall"
   (`colors.exhibit`), chapters on cream paper with a gold-ruled lead
   sentence. Steps with no content are skipped. Android back steps back.
2. **Quiz** (`destination/[id]/quiz`) — intro card (5 questions, best score,
   retakes allowed) → one question at a time, 4 option cards **shuffled for
   every attempt** (`prepareQuiz()`), instant feedback (correct = forest green,
   chosen-wrong = terracotta, options lock) → score screen (ring with X/5 and
   %, celebratory at 4+/5, encouraging below), Retake / Back. Every attempt is
   saved to `quiz_attempts`; the best is derived (`bestAttempt()`).
3. **Progress tab** — identity card (email + Sign out, or Guest + "Create an
   account" nudge), N/26 ring, quizzes taken, average and best score,
   per-province bars, and a "Your journey" list (visited badge + best score,
   tap → Details) with a friendly empty state.
4. **Auth** — Supabase email + password. Welcome screen on launch without a
   session (Create an account / Sign in / Continue as guest). Guests have
   every feature. A guest who signs up keeps their progress (rows are moved
   to the new account). Sign out returns to Welcome.
5. **Map tab** (`react-native-maps`) — 26 pins coloured by category, legend
   chip row that doubles as a category filter, "show the whole region"
   button, native callout (name + category → Details) plus a preview card.

### Identity model ("user key")

No schema change: the text column `device_id` on `quiz_attempts` and
`destination_completions` holds a generic **user key**:

- signed in → the Supabase auth user id;
- guest → a device UUID generated once (`expo-crypto`) and kept in
  AsyncStorage (`src/lib/localPrefs.ts`).

`IdentityContext` (`useIdentity()`) exposes `userKey`, `kind`
(`user`/`guest`), `email`, `label` ("Guest" or the email), `needsWelcome` and
the auth actions. Progress hooks include the user key in their cache key, so
they reload by themselves on sign-in / sign-out. The "Continue as guest"
choice is remembered, so guests are not shown Welcome on every launch.

## Fixed stack — do not substitute

- Latest Expo SDK (currently **58**; React Native 0.88, React 19.3) +
  **TypeScript strict**, scaffolded with create-expo-app.
- **Expo Router** — bottom tabs (Home / Explore / Map / Progress) inside a
  root stack that also holds Welcome, Sign In, Sign Up, Add, Details, Edit,
  Tour and Quiz. The stack uses `Stack.Protected` with `redirectTo`: without
  a session or a guest choice only Welcome (+ Sign In / Sign Up) is
  reachable. Typed routes and the React Compiler are on.
- **@react-native-async-storage/async-storage** (session + device id),
  **react-native-maps** (Map tab), **react-native-svg** (progress ring),
  **expo-crypto** (device UUID), **react-native-reanimated** (step
  transitions) — all included in Expo Go.
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
| `quiz_attempts` | `destination_id` → cascade, `device_id` (the user key), `score`, `total`, `taken_at`. One row per finished attempt. |
| `destination_completions` | `destination_id` → cascade, `device_id` (the user key), `completed_at`, unique `(destination_id, device_id)` — so "Mark as Visited" is idempotent per user. |

- **Categories**: Historical Site · Church & Religious · Museum & Art ·
  Natural Wonder · Heritage Town & Culture.
- **Provinces**: Cavite · Laguna · Batangas · Rizal · Quezon.
  Both lists also live in `src/constants/taxonomy.ts` and `scripts/lib/dataset.js`
  — change all three together.
- **RLS** is on for every table, with permissive policies for
  select/insert/update/delete plus explicit grants, **for both `anon`
  (guests) and `authenticated` (signed-in users)**. Run 3 had to add
  `authenticated`: with `anon`-only policies a signed-in user read zero
  destinations. Policy names keep their `_anon_` suffix because
  `scripts/lib/verify.js` looks them up by name.
- **Production note** — this is deliberately open for a school project. A
  real deployment would scope progress rows per user with `auth.uid()`
  policies, e.g. `using (device_id = auth.uid()::text) with check
  (device_id = auth.uid()::text)` for `authenticated`, give guests Supabase
  anonymous sign-in (or a signed token) instead of a client-chosen key, and
  restrict catalogue writes to editors.
- **Storage** — public bucket `destination-images` (5 MB limit, JPEG/PNG/WebP),
  with read/write policies for `anon` and `authenticated`.
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
GOOGLE_MAPS_ANDROID_API_KEY=        # blank for now — see "Google Maps" below
```

Only the `EXPO_PUBLIC_` variables may be read by app code. `SUPABASE_DB_URL`
is for setup scripts ONLY — never import it anywhere in the app. It currently
points at the `aws-0-ap-southeast-1` session pooler (port 5432), which works;
the direct host is IPv6-only and does not.

### Auth (Supabase email + password)

- supabase-js built-in auth; the session is persisted in AsyncStorage and
  refreshed only while the app is in the foreground (`src/lib/supabase.ts`).
  All calls go through `src/repositories/auth.ts`; friendly messages come from
  `friendlyAuthMessage()` in `src/lib/authForm.ts`.
- **Status at the end of Run 3: "Confirm email" is still ON** in the Supabase
  dashboard (`/auth/v1/settings` reports `mailer_autoconfirm: false`). So a
  real sign-up returns no session and the app shows "Check your inbox".
  Worse, the project uses Supabase's built-in mailer, which only allows a
  few emails per hour (Run 3's tests hit `over_email_send_rate_limit`) — so
  sign-ups will fail for most people until the owner turns the toggle OFF:
  **Dashboard → Authentication → Sign In / Providers → Email → "Confirm
  email" → off**. Then sign-up signs straight in and sends no email.
- `npm run auth:test` re-checks all of this live, and tests sign-in, RLS for
  the `authenticated` role and progress writes with a throwaway user that it
  creates directly in `auth.users` (via `SUPABASE_DB_URL`) and deletes again.

### Google Maps

- `react-native-maps` renders Google Maps on Android **in Expo Go with no API
  key of ours** (Expo Go ships its own). The web build cannot show native
  maps, so `DestinationMap.web.tsx` / `MapPreview.web.tsx` are schematic
  stand-ins with the same props.
- `app.config.js` adds the `react-native-maps` config plugin with
  `androidGoogleMapsApiKey` read from `GOOGLE_MAPS_ANDROID_API_KEY` in `.env`.
  **That key is needed only for the standalone APK in Run 4** (create it in
  Google Cloud with "Maps SDK for Android", restrict it to the package name
  + SHA-1). Config plugins only run in native builds, so Expo Go ignores it.
- The base map is styled warm and quiet (`mapStyle` in the theme). Pins use
  `pinColor`, which Google tints by hue only — hence category colours on
  clearly different hues (`colors.category*`).

### Scripts

| Command | What it does |
| --- | --- |
| `npm run db:setup` | **Full reset.** Runs `schema.sql` (drop + create), then seeds the real 26-destination dataset, then verifies. |
| `npm run db:seed` | Re-seeds the dataset only (`scripts/seed-full-dataset.js`): uploads the photos, then in one transaction deletes every destination and inserts the 26, then removes unused files from the bucket. Idempotent. |
| `npm run db:verify` | Read-only check: 6 tables with RLS, exactly the 26 dataset destinations, each with a cover, 3 photo rows and 5 sound questions, no placeholder URLs, 5 random photo links return 200. |
| `npm run db:test` | `scripts/verify-crud.mjs` (via `tsx`): exercises the app's real repositories against the live project with the publishable key — reads, search + filters, Featured selection, quiz and photo rows, upload, create / update / delete, and (Run 3) the quiz repository, quiz attempts, best score, idempotent "visited", per-key isolation, the Progress summary and guest → account transfer under a throwaway user key. Cleans up after itself. |
| `npm test` | Unit tests (`tests/*.test.ts`, Node's test runner via `tsx`): quiz scorer, shuffling, result tone, best scores, progress summary, auth validation and error messages, text and map helpers. |
| `npm run auth:test` | `scripts/verify-auth.mjs`: live auth check (settings, sign-up behaviour, sign-in, RLS for signed-in users, progress under the auth user id, wrong password, sign-out). Creates and deletes a throwaway user. |
| `node scripts/web-clickthrough.mjs <dist>` | Headless Playwright click-through of every flow on the exported web build (`npx expo export --platform web --output-dir <dist>`). Playwright is not a dependency: set `PLAYWRIGHT_MODULE` (and `PLAYWRIGHT_CHROMIUM` if its browser build is missing). Run 3: 59/59 checks. Cleans up its rows and test user. |
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
  - `src/repositories/destinations.ts`, `destinationImages.ts`, `quiz.ts`,
    `progress.ts`, `auth.ts` — factories that take a client, so Node scripts
    can reuse them. Keep them (and `src/lib/destinationForm.ts`, `featured.ts`,
    `base64.ts`, `errors.ts`, `quiz.ts`, `progress.ts`, `authForm.ts`,
    `mapRegion.ts`, `format.ts`, `src/constants/taxonomy.ts`) free of React
    Native imports — the unit tests and live scripts load them in Node.
  - **Progress is always keyed by `useIdentity().userKey`**; never read or
    write progress rows with any other id.
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
  Explore), `DataSyncContext`, `ToastContext`, `IdentityContext` (session,
  user key, auth actions). Nothing heavier.
- **Imports** use the `@/` alias for `src/`.

Folder layout:

```
src/
  app/                 Expo Router routes only
    _layout.tsx        Fonts, providers, root stack (Protected groups)
    welcome, sign-in, sign-up, add
    (tabs)/            _layout (tab bar), index (Home), explore, map, progress
    destination/[id]/  index (Details), edit, tour, quiz
  components/          Shared UI; form/ (the form), auth/ (auth fields),
                       map/ (native + .web map, preview, legend)
  constants/           taxonomy.ts
  context/             DataSync, ExploreFilters, Toast, Identity
  hooks/               useAsyncData, useDestinations, useProgress, useDebouncedValue
  lib/                 supabase, errors, destinationForm, featured, coverPhoto, base64,
                       format, quiz, progress, authForm, mapRegion, localPrefs
  repositories/        Data access (destinations, destinationImages, quiz, progress, auth)
  theme/               Design tokens + Paper, navigation and Google Maps themes
  types/               database.ts
tests/                 Unit tests (npm test)
app.config.js          Adds the react-native-maps plugin + key from .env
data/
  destinations-seed.json   The content (single source of truth)
  images/<slug>/           cover.jpg, gallery-1.jpg, gallery-2.jpg (committed)
  IMAGE_CREDITS.md         Generated list of photo authors and licences
supabase/schema.sql    Structure only
scripts/
  db-setup.js              schema + seed + verify
  seed-full-dataset.js     the seeder
  verify-crud.mjs          live data-layer tests (db:test)
  verify-auth.mjs          live auth tests (auth:test)
  web-clickthrough.mjs     headless click-through of the web build
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
- The lint rule `react-hooks/set-state-in-effect` rejects `setState` at the top
  of an effect. To react to a changed route param, adjust state during render
  with a "handled" marker (see the `?focus=` handling in `(tabs)/map.tsx`); to
  read fresh props inside an effect without re-running it, use
  `useEffectEvent` (see `DestinationMap.tsx`).
- `Stack.Protected` without `redirectTo` sends a blocked user to the first
  *unguarded* screen (here it was Sign In, not Welcome). Always pass
  `redirectTo`.
- After sign-in, navigate in an effect that waits for `identity.kind` to
  change — navigating right after `await signIn()` races the guard re-render.
- react-native-maps 1.29: the prop is `showsPointsOfInterests` (plural); call
  camera methods only after `onMapReady` (Android ignores earlier ones).
- Platform files: `Foo.web.tsx` next to `Foo.tsx` keeps a native-only library
  (react-native-maps) out of the web bundle. Keep their props in a shared
  `types.ts`.
- Hidden stack screens stay mounted on web, so Playwright locators need
  `.filter({ visible: true })`; RN `accessibilityRole="header"` is
  `role="heading"` on web; Paper `TextInput` labels are not ARIA labels.
- Supabase rejects `@example.com` sign-ups (`email_address_invalid`) and the
  built-in mailer rate-limits sign-ups quickly — test sign-in with a
  DB-created confirmed user instead (as `verify-auth.mjs` does).
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
  (The `react-native-maps` plugin entry in `app.config.js` is fine: it only
  matters for a native build and Expo Go ignores it.)
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

Phase 2 (Run 3)

- [x] Virtual Tour mode: intro → gallery (credited, swipeable) → History → Cultural Significance → completion with Mark as Visited → quiz
- [x] Quiz engine: shuffled options per attempt, instant feedback, score screen, every attempt saved, best score on Details
- [x] Progress tab: identity, N/26 ring, quiz stats, per-province bars, journey list, empty state
- [x] Supabase email + password auth, Welcome screen, Continue as guest, guest progress carried into a new account
- [x] Identity model: one "user key" (auth user id or device UUID) in `device_id`
- [x] RLS + grants extended to the `authenticated` role
- [x] Google Maps tab (`react-native-maps`): category pins, legend filter, callouts → Details; Details map preview → Map tab
- [x] Navigation: tabs Home / Explore / Map / Progress; Add is a FAB on Explore
- [x] Unit tests (`npm test`), live progress checks (`db:test`), live auth checks (`auth:test`), web click-through script

Next (Run 4)

- [ ] Owner: turn OFF "Confirm email" in the Supabase dashboard (see Auth above)
- [ ] Top up the 3 photo sets flagged in Run 2
- [ ] Polish pass on a real phone (insets, map pin legibility, transitions)
- [ ] EAS APK with `GOOGLE_MAPS_ANDROID_API_KEY`
- [ ] Portfolio README (screenshots, architecture, decisions)

## Not yet verified on a device

The app was checked with `tsc`, ESLint, the unit tests, an Android export
(Hermes bundle), the live database and auth scripts, and a 59-step headless
click-through of the web build. It has **not** been run on a physical Android
phone by the agent. The parts that only a phone can confirm:

- the photo picker and upload, keyboard avoidance in the forms (Add / Edit,
  Sign In / Sign Up), status-bar / navigation-bar insets;
- **native Google Maps** (web uses a schematic stand-in): pins and their hue
  colours, callout tap → Details, camera fly-to from Details, the `liteMode`
  preview on Details;
- swipe gestures in the tour gallery (web was driven with the arrow buttons),
  Reanimated step transitions, the Android back button stepping back through
  the tour and asking before leaving a quiz;
- session restore after killing the app (web reload was verified).
