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

### Run 4 features — built

1. **Get directions** — button on Details (under the address) and on the
   tour's completion step ("You've toured it virtually — visit it in
   person"). `openDirections()` in `src/lib/device.ts` opens the Google Maps
   universal link `https://www.google.com/maps/dir/?api=1&destination=<lat>,<lng>`
   (built by `directionsUrl()` in `src/lib/outbound.ts`); Android falls back
   to a `geo:` link, then a toast. No API key.
2. **Near me** — `LocationContext` (`useUserLocation()`), expo-location,
   foreground only. Never asks on launch: Explore shows `NearMePrompt` ("See
   what is near you" → Allow location / Not now, remembered) and the "Nearest
   first" chip also asks. Refused, or no fix at all → status `denied` and the
   whole feature hides. Distances: haversine in `src/lib/geo.ts`
   ("12.4 km away", "280 m away"), on `DestinationCard` and Details
   ("· straight-line distance"). Summaries now carry `latitude`/`longitude`.
3. **Favorites** — table `favorites` (see Database), `favoritesRepository`,
   `FavoritesContext` (`useFavorites()`): one shared set for every heart,
   optimistic toggle with rollback + toast on failure (`mergeFavoriteChanges()`
   in `src/lib/favorites.ts`). `<FavoriteButton>` on cards (over the photo) and
   in the Details top bar; a Favorites section on the Progress tab. Included in
   the guest → account transfer (`transferProgress`).
4. **Share** — share icon in the Details top bar → `shareDestination()`:
   name, one-line description (`oneLineSummary()`), "Town • Province".
5. **Offline** — `src/lib/offlineCache.ts` (pure, store injected) bound to
   AsyncStorage in `src/lib/appCache.ts`. The catalogue (full summary list),
   each fetched destination and its photo rows are saved on every successful
   read; an offline error is answered from the saved copy, and filtered
   Explore queries are re-filtered locally (`filterSummaries()`).
   `<OfflineBanner>` ("Offline — showing saved data" + Retry) on Home,
   Explore, Map and Details. Photos rely on expo-image's disk cache. Writes
   are not queued.
6. **Haptics** — `tapFeedback()` (quiz answer, favorite toggle) and
   `successFeedback()` (quiz finished, Mark as Visited), no-ops on web.
7. **Onboarding** — `src/app/onboarding.tsx`, 3 slides, Skip / Next / Get
   started, flag `vtour.onboardingSeen`. Lives in `IdentityContext`
   (`needsOnboarding`, `finishOnboarding`) so it loads before the splash hides.
   Shown only on a true first launch (no session, no guest choice); existing
   users are marked as having seen it.

### Run 5 — platform pass (built)

1. **Dark mode** — Settings → Appearance: System / Light / Dark (default
   System). Instant, app-wide (Paper, navigation, map styles, status bars,
   window background via expo-system-ui). See Design system.
2. **Filipino / English UI** — Settings → Language. Instant, no restart.
   See Languages.
3. **Settings** (`src/app/settings.tsx`, gear in the Home hero and the
   Progress header): Appearance, Language (+ "content stays English"),
   Narration (show the Listen button; speed Normal / Slow), About (version
   from the app config — app.json on web — WMA 306 line, GitHub link),
   Legal (Photo credits, open-source note). All saved as one AsyncStorage
   value (`vtour.preferences`, `PreferencesContext`, parsed by
   `src/lib/preferences.ts`) and read before the splash hides.
4. **Photo Credits** (`src/app/credits.tsx`) — all 78 credit lines, live from
   `destination_images.caption` (`destinationImagesRepository.listAll()`,
   grouped by `groupCredits()`), Commons framing sentence on top.
5. **Narration** — `<NarrationButton>` on the History and Cultural
   Significance chapters: expo-speech reads "<title>. <chapter>" in en-PH /
   en-US (`pickSpeechLanguage`), rate from Settings, icon swap + pulse,
   light haptic. State machine in `src/lib/narration.ts` (utterance ids ignore
   late callbacks); `useNarration` stops on step change, tour close and app
   background, and hides the button when no English voice answers within
   2 s (also on web without voices).
6. **Map** — custom `<MapPin>` markers (category colour + icon, `pinRim`
   rim, grows when selected). Each marker sets `tracksViewChanges` only for
   `motion.markerSettle` (400 ms) after mount / (de)selection / theme change,
   then freezes. Chip-style legend with icons and counts; dark map style;
   preview card with category chip, outline and entrance animation; the
   Details lite-mode preview remounts per theme. Camera moves were already
   `animateToRegion` (Run 3).
7. **Accessibility** — `AppIconButton`, 44 dp chips, contrast audit (5 light
   pairs fixed), large-font layout fixes (Details action bar stacks at
   fontScale ≥ 1.15, Progress nudge wraps, segmented options stack icon over
   label).

### Run 6 — feature modules (built)

Every module is themed (tokens only, light + dark), localized (en + fil),
accessible (labels / roles, ≥ 44 dp, no colour-only meaning) and degrades
offline like the catalogue. **The required (professor-spec) flows did not
change**: the 134 earlier click-through checks still pass unchanged.

1. **360° view** — "View in 360°" opens Google Street View with the no-key
   URL `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=<lat>,<lng>`
   (`streetViewUrl()` in `src/lib/outbound.ts`, `openStreetView()` in
   `device.ts`, light haptic). On Details (next to Get directions) and as a
   card on the tour's **Gallery step** — not a step of its own, so the tour's
   step sequence (Intro → Gallery → History → Culture → Complete) and every
   flow built on it are unchanged. Hidden offline and without coordinates.
   Shipped for all 26 destinations: the build-time coverage check
   (Street View metadata endpoint with the Maps key) returned
   `REQUEST_DENIED` — "This API is not activated on your API project" — so
   no per-destination curation; Google shows the map where there is no
   panorama.
2. **Auto-generated starter quiz** for destinations added in the app —
   `src/lib/quizGenerator.ts` (pure, seeded: FNV-1a hash of the destination
   id → mulberry32). Five slots, each the first generator that can build a
   sound question and is unused: province (all 5 provinces as options) ·
   town (3 other catalogue towns) · category (3 of the other 4) · "Which
   destination is described here?" (lead sentence, name masked; other
   catalogue names) · fill-in-the-blank from the description (≥ 14 words;
   other long words of the same description). Fallbacks: "Which of these is
   a <category> in <province>?" (only when no other entry shares both),
   a category + province statement, the region (IV-A), true / false.
   Correct answers always come from the user's own fields. `syncAutoQuiz()`
   (`src/lib/autoQuiz.ts`, repo injected) runs after every save in
   `DestinationForm`: create → generate; edit of name / description /
   municipality / province / category → delete the `source='auto'` rows and
   re-insert; other edits leave it (but backfill a quiz-less entry). A
   destination with any curated question is **never** touched
   (`quizRepository.replaceAutoQuiz` → `'skipped-curated'`). Best-effort: a
   quiz failure never undoes the save. The quiz intro shows an
   "Auto-generated starter quiz" badge and an adapted evidence line.
3. **Achievements & badges** — `src/lib/achievements.ts`, derived from
   visits, attempts and favorites only (no table). Registry `BADGES` (display
   order): First Journey (1 visit) · Cavite / Laguna / Batangas / Rizal /
   Quezon Explorer (every catalogue destination of the province) · Heritage
   Scholar (perfect score on 5 **different** destinations — retakes of one
   place count once) · Quiz Enthusiast (15 attempts) · Collector (8
   favorites) · CALABARZON Master (every destination in the catalogue).
   Thresholds in `BADGE_THRESHOLDS`. The earned date is the time of the row
   that made the rule hold (nth row in time order; for sets, the latest
   visit of the set). `/badges` (from a card on Progress): 2-column grid,
   earned = full colour + "Earned <date>", locked = dashed outline + lock +
   "Locked · n of m" + meter. Celebration: `AchievementsContext`
   (`checkAchievements()` after a saved quiz, after Mark as Visited, and when
   Progress is focused and loaded) shows a **non-blocking banner** below the
   top bar (success haptic, auto-dismiss 4.5 s, View → /badges) — a banner,
   not a modal, so it can never block the flow underneath. "Seen" ids per
   user key in AsyncStorage (`vtour.badgesSeen.<userKey>`), so each fires
   once.
4. **Star ratings** — table `ratings` (below), `ratingsRepository`
   (`rate` = upsert on (destination, key), `getMine`, `listForDestination`,
   `listAll` (destination + stars only), `listMine`). Maths in
   `src/lib/ratings.ts` (average to one decimal, half-up). Details:
   `<RatingCard>` — five 48 dp star radios (filled vs outline + spelled-out
   label), own rating editable, average + count; a save calls
   `notifyChanged()` so cards and Insights refresh. Explore cards:
   `<RatingInline>` "★ 4.6 (12)" when ratings exist. Offline: the input
   hides, the cached average shows with a note (reads go through the offline
   cache). Included in the guest → account transfer (the account's own
   rating wins on a clash).
5. **Heritage Insights** — `/insights`, from a Progress header icon
   (chart) and a Home card. `computeInsights()` (`src/lib/insights.ts`) over
   every visit / attempt / rating (`progressRepository.listAllCompletions`,
   `listAllAttempts`, `ratingsRepository.listAll` — no user keys): totals,
   Most visited (top 5), Top rated (top 5, ≥ 1 rating), Toughest quizzes
   (lowest average %, ≥ 1 attempt), visits by province and by category —
   drawn with `Meter` rows, no chart library. Empty states; pull to refresh;
   saved for offline.
6. **Certificate of Completion** — `/certificate?scope=<Province|region>`.
   `qualifyingCertificates()` (`src/lib/certificate.ts`): a province when all
   its destinations are visited, the region ("CALABARZON Heritage
   Explorer") when all are. "View certificate" on the earned province row
   and on the overview (all visited) in Progress, and on the matching
   badges. Design: parchment band + gold frame, laurel sprigs (rotated
   `leaf` icons) around a compass medallion, Playfair name, gold rule, date,
   app line — using the `parchment*` design constants, so it stays cream in
   both themes. Holder: the name typed on the screen
   (`vtour.certificateName`), else the email prefix, else "Guest Explorer".
   Share: `src/lib/certificateShare.ts` captures with
   **react-native-view-shot** (`captureRef`, PNG) → iOS shares the image;
   **Android shares a text message** (React Native's `Share` carries text
   only on Android, and this run allowed no other native module —
   installing expo-sharing was refused). Web: `certificateShare.web.ts`
   (text only; view-shot's web capture needs `html2canvas-pro`, which would
   break the web export).
7. **Field Trip Planner** — `/planner`, from a Map header button
   (`map-marker-path`) and a Home card. Select: searchable checklist
   (`role=checkbox`, selection order numbered), counter "n of 8 stops ·
   Google Maps takes up to 8 stops", optional "Start from my location"
   (shown while location is granted or not yet asked; asking happens on the
   toggle). Plan: **Suggested order** = nearest-neighbour from the location
   (or the first selected stop), ties keep selection order; up / down /
   remove per stop → "Your order" (+ "Use the suggested order"). Per-leg and
   total straight-line km ("approximate"); time estimate = km × 1.35 (road
   factor) ÷ 35 km/h, rounded to 5 min ("a rough estimate"). Route on an
   embedded map: `TripMap.tsx` (native Polyline + numbered `TripPin`s,
   markers freeze after 400 ms) / `TripMap.web.tsx` (schematic). Hand-off:
   `buildDirectionsUrl()` → `https://www.google.com/maps/dir/?api=1&origin=…&destination=…&waypoints=a%7Cb&travelmode=driving`
   (origin = location or first stop; capped at `MAX_STOPS` = 8; hidden
   behind a note offline). Plans: save / load / delete on the phone only
   (`vtour.tripPlans`, `src/lib/tripPlans.ts` with an injected store,
   bound in `appTripPlans.ts`; max 30 plans).

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
- **@react-native-async-storage/async-storage** (session + device id +
  offline cache), **react-native-maps** (Map tab), **react-native-svg**
  (progress ring), **expo-crypto** (device UUID), **react-native-reanimated**
  (step transitions), **expo-location** (Near me), **expo-haptics**,
  **expo-speech** (narration), **react-native-view-shot** (Run 6, the
  certificate image) — all included in Expo Go.
- **react-native-paper** (Material Design 3) with the custom theme below.
- **@supabase/supabase-js** for all data.
- **expo-image** for all image rendering; **expo-image-picker** +
  **expo-image-manipulator** for uploads.
- **No Redux** — hooks + lightweight context only.

## Design system

Heritage-museum aesthetic, in a **light and a dark theme** (Run 5). **Zero
ad-hoc colours or font sizes inside screens or components** — the colour
sweep (`grep` for `#…` / `rgba(` outside `src/theme`) must stay empty.

Where things live:

| File | Holds |
| --- | --- |
| `src/theme/palettes.ts` | `lightPalette` and `darkPalette` — the same keys (type `Palette`). Add a token to BOTH. |
| `src/theme/index.ts` | Static tokens (spacing, radius, iconSize, layout, motion, fonts, typography) + `buildTheme()` → `THEMES.light / .dark` (colours, elevation, map style, Paper theme, navigation theme, status-bar style). |
| `src/theme/ThemeProvider.tsx` | `AppThemeProvider`, `useAppTheme()`, `makeStyles()`. |
| `src/theme/mapStyles.ts` | `lightMapStyle` (warm parchment) and `darkMapStyle` (night gallery). |
| `src/theme/contrast.ts`, `contrastPairs.ts` | WCAG maths and every text/icon token pair with its AA minimum — unit-tested for both palettes. |

Styles: never `StyleSheet.create` at module level with colours. Write

```ts
const useStyles = makeStyles(({ colors, elevation }) => ({ card: { backgroundColor: colors.surface, ...elevation.card } }));
function Card() { const styles = useStyles(); … }
```

and read colours in components with `const { colors } = useAppTheme();`.
The sheet is built once per theme and cached. Status bars: `<ThemedStatusBar />`
(`overDark` over photos, the hero band or the exhibit wall).

Core values (light / dark):

| Token | Light | Dark |
| --- | --- | --- |
| primary (terracotta) | `#9A3B26` | `#E8957C` (filled buttons get dark `onPrimary` text, as in M3) |
| secondary (heritage gold) | `#C9A227` | `#D8B550` |
| background | `#FAF6EF` cream | `#16110E` deep warm brown (never pure black) |
| surface | `#FFFFFF` | `#221B17` |
| ink | `#2A2420` | `#F2EAE0` |
| muted | `#6E655D` (was `#8A8178`, failed AA) | `#A99D92` |
| success | `#2F5D46` | `#8CC7A6` |

Semantic tokens to know:

- `onPrimary` = text ON a terracotta fill only. Text over photos, the hero
  band and the exhibit wall uses **`onPhoto` / `onPhotoMuted`** (always white).
- **Design constants, identical in both themes:** `exhibit`, `onExhibit*`,
  `glass`, `onPhoto*`, `photoShade*` — the tour's dark "gallery wall" stays
  itself in light and dark.
- Home hero: `heroBackground`, `heroWatermark`, `heroAccent`.
- Certificate (Run 6): `parchment`, `parchmentDeep`, `onParchment`,
  `onParchmentSoft`, `parchmentGold` — design constants (same in both
  themes, a printed document), contrast-audited in `contrastPairs.ts`.
- Map pins: `category*` (distinct hues), `pinRim` (white on the light map,
  deep brown on the dark map).

- **Typography** — Playfair Display for screen titles and destination names;
  Inter for body. `<AppText variant="…">`; variants in `typography`.
- **Spacing** — 4/8pt scale: `spacing.xs` 4 … `spacing.huge` 64.
- **Shape** — 12px card radius (`radius.md`), soft warm shadows
  (`elevation.card` / `raised` — deeper on dark).
- **Every screen** has a loading state, a friendly empty state, and an error
  state with retry (`StateViews.tsx`, `Skeleton.tsx`).
- **Icons** — Material Community Icons through `<AppIcon>`; icon buttons
  through **`<AppIconButton>`** (48 dp box, 44 dp `compact`) — never Paper's
  `IconButton` directly (its box is only 34–38 dp).
- **Accessibility** — touch targets ≥ 44 dp (48 dp default; chips 44 dp),
  labels and roles on every pressable, font scaling capped at 1.3× (layouts
  checked at 1.3× on a 360 dp screen in Run 5), quiz feedback = colour + icon.

### Languages (Run 5)

- `src/i18n/en.ts` is the source of truth (666 keys since Run 6; 490 in Run 5); `src/i18n/fil.ts` has
  the same shape (`DictionaryShape<…>`, so a missing key is a type error).
  Filipino = everyday Taglish UI Filipino ("I-save", "Mga Paborito",
  "Tuklasin"); proper nouns stay.
- In components: `const { t, categoryLabel, provinceTagline, errorMessage,
  errorTitle, date, distance } = useI18n();` — `t('explore.count', { count })`.
  Keys are type-checked; `{{placeholders}}`; `{ one, other }` plurals.
- Pure modules never return English sentences for the UI: validation and
  auth helpers return **keys**; `AppError` carries `contextKey` (its
  `.message` stays English for scripts/logs) — show errors with
  `errorMessage(error)`. Category values stay English in the database;
  their labels come from `categories.<slug>` (`CATEGORY_KEYS`).
- **Destination content (write-ups, quizzes) stays English by design**
  (a note under Settings → Language says so).
- `npm run i18n:check` must pass: same keys / placeholders / plural shape in
  both languages, no empty text, and a sweep of `src/app` + `src/components`
  for hard-coded UI text outside `t()` (small allowlist with reasons).

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
| `favorites` (Run 4) | `destination_id` → cascade, `device_id` (the user key), `created_at`, unique `(destination_id, device_id)`. Same permissive anon + authenticated policies. Added to the live DB by `supabase/migrations/20261118_favorites.sql` — no reset. |
| `ratings` (Run 6) | `destination_id` → cascade, `device_id` (the user key), `stars` (CHECK 1–5), `created_at`, `updated_at` (trigger), unique `(destination_id, device_id)`. Same permissive policies. Added live by `supabase/migrations/20261122_ratings.sql`. |

`quiz_questions.source` (Run 6): `text not null default 'curated'`, CHECK
`'curated' | 'auto'`, added live by `supabase/migrations/20261121_quiz_source.sql`
(every existing row became 'curated'). Seeding never sets it, so the dataset
is always curated.

Run 6 migration run (2026-11-21, `npm run db:migrate`, twice — idempotent):
before = after = 26 destinations, 78 photos, 130 questions, 520 options,
0 attempts, 0 visits, 0 favorites; `ratings` created empty. `db-migrate.js`
now guards all of these counts (tables a migration creates may appear).

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
| `npm run db:migrate` | Runs every file in `supabase/migrations/` (idempotent, one transaction each) against the live DB, and fails if existing destination / photo / question / option / attempt / visit / favorite / rating counts change. Use this — not `db:setup` — for additive schema changes. |
| `npm run db:sync-photos` | **Non-destructive photo top-up**: uploads the processed photos and updates only `cover_image_url` and the `destination_images` URLs / captions by stable id. Use it after replacing photos so live progress and favorites survive (unlike `db:seed`). |
| `npm run i18n:check` | `scripts/i18n-check.ts`: en/fil dictionaries match (keys, placeholders, plurals, no empty text) and no hard-coded UI text in `src/app` / `src/components`. Run 5: 490 keys, clean. |
| `npm run secrets:check` | Secret scan before any push: `.env` ignored and never committed; DB password (raw / URL-encoded), `sb_secret`, credentialed connection strings and Google keys absent from every tracked file and every commit. Prints counts only. |
| `npm run db:seed` | Re-seeds the dataset only (`scripts/seed-full-dataset.js`): uploads the photos, then in one transaction deletes every destination and inserts the 26, then removes unused files from the bucket. Idempotent. |
| `npm run db:verify` | Read-only check: 8 tables with RLS (incl. `ratings`), exactly the 26 dataset destinations, each with a cover, 3 photo rows and 5 sound questions, no placeholder URLs, 5 random photo links return 200. |
| `npm run db:test` | `scripts/verify-crud.mjs` (via `tsx`): exercises the app's real repositories against the live project with the publishable key — reads, search + filters, Featured selection, quiz and photo rows, upload, create / update / delete, and (Run 3) the quiz repository, quiz attempts, best score, idempotent "visited", per-key isolation, the Progress summary and guest → account transfer under a throwaway user key. Run 6 adds 11 live checks (50 in all): every dataset question curated; create → 5-question starter quiz; regeneration on a quiz-field edit (old rows and options gone), none on an address edit; curated untouched; cascade; ratings upsert, unique + 1–5 check, per-key isolation, average, transfer dedupe; insights / badges / certificates from live rows. Cleans up after itself. |
| `npm test` | Unit tests (`tests/*.test.ts`, Node's test runner via `tsx`): quiz scorer, shuffling, result tone, best scores, progress summary, auth validation and error messages, text and map helpers. |
| `npm run auth:test` | `scripts/verify-auth.mjs`: live auth check (settings, sign-up behaviour, sign-in, RLS for signed-in users, progress under the auth user id, wrong password, sign-out). Creates and deletes a throwaway user. |
| `node scripts/web-clickthrough.mjs <dist>` | Headless Playwright click-through of every flow on the exported web build (`npx expo export --platform web --output-dir <dist>`). Playwright is not a dependency: set `PLAYWRIGHT_MODULE` (and `PLAYWRIGHT_CHROMIUM` if its browser build is missing). Run 3: 59/59; Run 4: 94/94; Run 5: 134/134; **Run 6: 205/205** (the 134 earlier checks first, unchanged, then 71 for 360°, ratings, badges + celebration, certificate in light and dark, insights, the planner and an auto-quiz destination added through the form and deleted again) (adds narration with a stubbed `speechSynthesis`, Settings, dark mode verified by sampling the page background on five screens, Filipino strings, Photo Credits; the sign-up refusal now uses the pre-created account's address, so it works whether "Confirm email" is on or off). Run 4 added (adds onboarding, Near me with a fake Calamba position, favorites, share / directions captured by stubbing `navigator.share` / `window.open`, offline via `context.setOffline`, a second fresh browser for Skip / Not now / refused permission). Cleans up its rows and test user. Playwright lives in the npx cache (`…/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright`); its expected browser build is missing, so point `PLAYWRIGHT_CHROMIUM` at `…/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe`. |
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
    `progress.ts`, `favorites.ts`, `ratings.ts`, `auth.ts` — factories that take a client, so Node scripts
    can reuse them. Keep them (and `src/lib/destinationForm.ts`, `featured.ts`,
    `base64.ts`, `errors.ts`, `quiz.ts`, `progress.ts`, `authForm.ts`,
    `mapRegion.ts`, `format.ts`, `geo.ts`, `favorites.ts`, `offlineCache.ts`,
    `outbound.ts`, Run 6's `quizGenerator.ts`, `autoQuiz.ts`, `achievements.ts`,
    `ratings.ts`, `insights.ts`, `certificate.ts`, `planner.ts`, `tripPlans.ts`,
    `src/constants/taxonomy.ts`) free of React Native imports — the unit tests and live scripts load them in Node.
  - **Progress is always keyed by `useIdentity().userKey`**; never read or
    write progress rows with any other id.
  - `src/repositories/index.ts` — binds the factories to the app client.
    Import repositories from `@/repositories`.
- **Lists use summaries.** `destinationsRepository.list()` returns
  `DestinationSummary` rows (id, name, municipality, province, category, cover,
  latitude, longitude)
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
  user key, auth actions, onboarding flag), `LocationContext` (Near me),
  `FavoritesContext` (hearts), `AchievementsContext` (Run 6: badge
  celebrations). Nothing heavier. A favorite toggle reloads the
  favorites query only (not `notifyChanged()`), since every heart reads the
  same context.
- **Imports** use the `@/` alias for `src/`.

Folder layout:

```
src/
  app/                 Expo Router routes only
    _layout.tsx        Fonts, providers, root stack (Protected groups)
    welcome, sign-in, sign-up, add, settings, credits
    badges, insights, certificate, planner   (Run 6)
    (tabs)/            _layout (tab bar), index (Home), explore, map, progress
    destination/[id]/  index (Details), edit, tour, quiz
  components/          Shared UI; form/ (the form), auth/ (auth fields),
                       map/ (native + .web map, preview, legend, TripMap + TripPin)
                       RatingCard, StarRating (Run 6)
  constants/           taxonomy.ts
  context/             DataSync, ExploreFilters, Toast, Identity, Location, Favorites, Achievements
  hooks/               useAsyncData, useDestinations, useProgress, useDebouncedValue,
                       useRatings, useInsights, useAchievements (Run 6)
  lib/                 supabase, errors, destinationForm, featured, coverPhoto, base64,
                       format, quiz, progress, authForm, mapRegion, localPrefs,
                       geo, favorites, offlineCache + appCache, outbound, device,
                       Run 6: quizGenerator, autoQuiz, achievements, ratings, insights,
                       certificate + certificateShare(.web), planner, tripPlans + appTripPlans
  repositories/        Data access (destinations, destinationImages, quiz, progress, favorites, ratings, auth)
  theme/               Design tokens + Paper, navigation and Google Maps themes
  types/               database.ts
tests/                 Unit tests (npm test)
app.config.js          Adds the react-native-maps plugin + key from .env
data/
  destinations-seed.json   The content (single source of truth)
  images/<slug>/           cover.jpg, gallery-1.jpg, gallery-2.jpg (committed)
  IMAGE_CREDITS.md         Generated list of photo authors and licences
supabase/schema.sql    Structure only (+ supabase/migrations/ for additive changes)
docs/screenshots/      README screenshots (from the web click-through)
eas.json               EAS profiles ("preview" = APK)
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
- Typed routes: a new route file is not known to `tsc` until the route types
  regenerate — run `npx expo start` briefly (`expo export` does not refresh
  `.expo/types/router.d.ts`).
- On web, `Share.share()` resolves to `undefined` (and rejects with
  `AbortError` when cancelled) — never read `result.action` unguarded.
- A Paper dialog duplicates button labels that also sit under its backdrop
  (e.g. "Sign out"); the click-through's `clickActionable()` picks the one
  that can really be clicked.
- `db:seed` deletes and re-inserts every destination, which cascades away all
  quiz attempts, visits and favorites. Never use it just to change photos —
  use `db:sync-photos`.
- **EAS builds**: EAS shallow-clones the repo through a `file://` URL, and the
  apostrophe in "Clark's Folder" breaks it (even through a junction, because
  git reports the real top-level). Build with
  `cd /c/dev/vtour && EAS_NO_VCS=1 npx eas-cli@latest build -p android --profile preview --non-interactive --no-wait`
  (junction `C:\dev\vtour` exists; `EAS_NO_VCS` packs the folder honouring
  `.easignore`, which repeats `.gitignore` and drops `data/images`, `docs`,
  `tests`). `.env` never reaches EAS: the two `EXPO_PUBLIC_` values (plaintext /
  sensitive) and `GOOGLE_MAPS_ANDROID_API_KEY` (secret) are EAS environment
  variables for `preview` and `production`. `app.config.js` fails an EAS
  Android build that lacks the Maps key.
- **Release builds: R8 is OFF on purpose** (Run 4.1). The SDK 58 template
  enables R8 with `proguard-android-optimize` by default, and v1.0.0 crashed at
  launch on a device: `androidx.startup.InitializationProvider` →
  `WorkManagerInitializer` → "Failed to create an instance of class
  androidx.work.impl.WorkDatabase". WorkManager is pulled in by
  **react-native-maps** (`androidx.work:work-runtime` 2.9.1, for its URL-tile
  worker); it builds its Room database by reflection, which R8 broke.
  `expo-build-properties` in app.json now sets `enableMinifyInReleaseBuilds`
  and `enableShrinkResourcesInReleaseBuilds` to false and appends keep rules
  (androidx.work, androidx.startup initializers, Room `_Impl`, rnmaps, Expo
  modules) so re-enabling R8 later starts from a safer base — but only re-enable
  it after testing the release APK on a real phone. Expo Go never shows this
  class of bug: test every standalone build on a device.
- App version lives in app.json (`version`, `android.versionCode`):
  `eas.json` uses `appVersionSource: "local"`. Bump both for each APK.
- `npx expo prebuild` (useful to inspect the generated Gradle files) rewrites
  the `android` / `ios` npm scripts to `expo run:*` — restore them to
  `expo start --android/--ios`, and delete the generated `android/`.
- **Theme switching**: styles are per-theme objects from `makeStyles`; a
  Google Maps lite-mode `MapView` does not restyle in place — give it
  `key={scheme}`.
- **expo-constants on web** has no manifest in a static export
  (`process.env.APP_MANIFEST` is empty): read the version as
  `Constants.expoConfig?.version ?? appJson.expo.version`, never a literal.
- **expo-speech on web** waits forever for `voiceschanged` when the browser
  has no voices — always race `getAvailableVoicesAsync()` against a timeout.
- **Typed i18n keys**: dynamic keys need template literals the type system
  can check (`` t(`onboarding.slides.${slide.key}.title`) `` with a union-typed
  `key`).
- Web click-through: tabs and stack screens stay mounted, so a label can
  match a hidden twin (e.g. Home's gear behind Progress) — use
  `clickActionable()`.
- With "Confirm email" OFF, a sign-up in a test really creates an account —
  tests must never sign up with a fresh address (use the pre-created one,
  and clean up by email).
- `eas credentials` is interactive only. The keystore fingerprints come from
  the Expo GraphQL API (`androidAppBuildCredentialsList → androidKeystore →
  sha1CertificateFingerprint`); the APK is v2-signed only, so JRE 8's
  `keytool -printcert -jarfile` cannot read it.
- **react-native-view-shot on web** imports `html2canvas-pro` (an optional
  peer we do not ship), and Metro fails the web export on it. Keep every
  view-shot import in a native-only file with a `.web.ts` twin
  (`certificateShare.ts` / `.web.ts`).
- **React Native `Share` on Android carries text only** (`message`); `url`
  is iOS-only. Sharing an image file on Android needs a module such as
  expo-sharing (in Expo Go) — not added in Run 6 (the run allowed only
  view-shot; the install was refused), so Android shares text.
- **Street View metadata** (`maps.googleapis.com/maps/api/streetview/metadata`)
  answers `REQUEST_DENIED` with our Maps key (API not enabled in its Google
  Cloud project). The pano URL needs no key, so the feature does not depend
  on it.
- Web click-through: Paper dialogs fade in — wait ~800 ms before clicking
  inside one; and wait for a pushed screen's heading before typing into
  `input:visible` (a hidden tab's search box can match during the
  transition — Run 6 added that wait before the Sign In fill).
- Celebrations must not be modals: anything that covers the screen breaks
  flows (and the click-through) that continue underneath. Use the banner.
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

Run 4

- [x] Get directions (Details + tour completion), Near me (distances + Nearest first), favorites, share, offline catalogue, haptics, onboarding
- [x] `favorites` table applied live with an additive migration (`db:migrate`)
- [x] Photo top-up: Pagsanjan Falls cover + gallery-2 replaced; Caleruega and Kamay ni Hesus re-searched, no better licensed image, sets kept
- [x] QA: 44 unit, 38 db:test, 6 auth:test, 94 web click-through, tsc, lint, expo-doctor 20/20, Android Hermes export
- [x] Public GitHub repo `clarkdesepida0154/virtual-tour-calabarzon` after a clean secret scan; `.gitattributes`
- [x] Portfolio README with 8 screenshots (`docs/screenshots/`)
- [x] Device check by the owner on Android and iOS (Runs 1–3 features)
- [x] EAS APK v1.0.0 (preview profile, `com.clark0154.virtualtour`, EAS-managed keystore SHA-1 `D1:36:82:72:91:88:2B:15:11:F9:72:26:77:8C:64:8A:B8:C9:B4:25`) attached to GitHub Release v1.0.0
- [x] Run 4.1: v1.0.0 launch crash fixed (R8 off + keep rules) → v1.0.1 (versionCode 2) on GitHub Releases
- [ ] Owner: restrict the Google Maps key to the package name + the EAS keystore SHA-1

Run 5 (platform pass)

- [x] Dark mode (light + dark palettes, System / Light / Dark, map style, status bars)
- [x] Filipino / English UI (490 keys, i18n:check), content stays English
- [x] Settings, About, Photo Credits screens (gear on Home and Progress)
- [x] Accessibility pass (AA contrast audit, 44–48 dp targets, large-font layouts)
- [x] Map upgrade (custom pins with frozen bitmaps, chip legend, dark style, card polish)
- [x] Audio narration in the tour (expo-speech)
- [x] Owner: "Confirm email" turned OFF (auth:test reports it OFF on 2026-11-21)

Run 6 (feature modules)

- [x] 360° Street View link (Details + tour Gallery card); metadata curation skipped (API not enabled)
- [x] Auto-generated starter quiz for user-added destinations (`quiz_questions.source` migration)
- [x] 10 badges derived from existing rows, Badges screen, once-only celebration banner
- [x] Star ratings (`ratings` migration), Details input, Explore ★ average, guest transfer
- [x] Heritage Insights (Progress icon + Home card)
- [x] Certificates of completion (province / region), view-shot capture, share
- [x] Field Trip Planner (nearest-neighbour order, reorder, route map, Google Maps hand-off, saved plans)
- [x] QA: 138 unit, 50 db:test, 6 auth:test, 205 web click-through, i18n 666 keys, tsc, lint, expo-doctor 20/20, Android Hermes export

Next (Run 7)

- [ ] Final QA + device pass for Runs 5–6 (both themes, Filipino, narration, native pins, Run 6 list below)
- [ ] APK v1.1.0 (bump `version` + `android.versionCode`), GitHub Release
- [ ] Documentation, wireframes, web demo deploy
- [ ] Decide on image sharing for Android certificates (expo-sharing, Expo Go-supported) — needs the architect's OK
- [ ] Owner (optional): enable the Street View Static API on the Maps key's project if per-destination 360° curation is wanted

## Not yet verified on a device

**Run 6 is web- and test-verified only.** Phone-only parts: the Street View
hand-off (Google Maps app opening the pano; what Google shows where there is
no panorama), the certificate capture with react-native-view-shot and the
share sheet (image on iOS, text on Android), the planner's native map
(Polyline, numbered marker bitmaps freezing, camera framing), the Google
Maps directions hand-off with waypoints in the app, "Start from my
location" with real GPS and the system permission dialog, the success
haptic of the badge banner, star taps and their haptic, and the new screens
at 1.3× font scale on a 360 dp phone.

The owner verified Runs 1–4 on physical devices (v1.0.1 APK on Android,
Expo Go on iOS). **Run 5 is web- and test-verified only**: both themes on
real screens (OLED blacks, status / navigation bar icons in edge-to-edge),
the Filipino walkthrough, narration audio (voice, rate, auto-stop, the
button hiding on a phone without an English voice), custom markers on
native Google Maps (bitmap freeze, selected growth, dark style), haptics on
the narration toggle, and the large-font action-bar stacking (web reports
fontScale 1). Before Run 5, the **Run 4 features** were checked with tsc, ESLint, unit
tests, an Android Hermes export, the live scripts and a 94-step web
click-through — not yet on a phone. Phone-only parts of Run 4: the system
location dialog and real GPS distances, haptics, the Google Maps app hand-off,
the native share sheet, offline behaviour with airplane mode (including
expo-image's photo cache), and the onboarding swipe. The older phone-only
list, for reference:

- the photo picker and upload, keyboard avoidance in the forms (Add / Edit,
  Sign In / Sign Up), status-bar / navigation-bar insets;
- **native Google Maps** (web uses a schematic stand-in): pins and their hue
  colours, callout tap → Details, camera fly-to from Details, the `liteMode`
  preview on Details;
- swipe gestures in the tour gallery (web was driven with the arrow buttons),
  Reanimated step transitions, the Android back button stepping back through
  the tour and asking before leaving a quiz;
- session restore after killing the app (web reload was verified).
