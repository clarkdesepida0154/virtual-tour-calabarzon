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

### Phase 2 — not built (the schema already supports it)

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

`supabase/schema.sql` is the single source of truth. It is re-runnable: it
starts with a RESET section that drops everything it creates.

| Table | Purpose |
| --- | --- |
| `destinations` | The catalogue. `id`, `name`, `description`, `address`, `municipality`, `province` (CHECK: the 5 provinces), `category` (CHECK: the 5 categories), `latitude`, `longitude`, `history`, `cultural_significance`, `cover_image_url`, `created_at`, `updated_at` (kept fresh by a trigger). |
| `destination_images` | Phase 2 gallery: `destination_id` → cascade, `image_url`, `caption`, `sort_order`. |
| `quiz_questions` | `destination_id` → cascade, `question_text`, `sort_order`. |
| `quiz_options` | `question_id` → cascade, `option_text`, `is_correct`. |
| `quiz_attempts` | `destination_id` → cascade, `device_id`, `score`, `total`, `taken_at`. |
| `destination_completions` | `destination_id` → cascade, `device_id`, `completed_at`, unique `(destination_id, device_id)`. |

- **Categories**: Historical Site · Church & Religious · Museum & Art ·
  Natural Wonder · Heritage Town & Culture.
- **Provinces**: Cavite · Laguna · Batangas · Rizal · Quezon.
  Both lists also live in `src/constants/taxonomy.ts` — change them together.
- **RLS** is on for every table, with permissive `anon` policies for
  select/insert/update/delete plus explicit grants. There is no sign-in; the
  publishable key maps to the `anon` role.
- **Storage** — public bucket `destination-images` (5 MB limit, JPEG/PNG/WebP),
  with `anon` read/write policies. Uploaded covers go to `covers/<timestamp>-<random>.jpg`.
- **Seeds** — 6 sample destinations at the bottom of `schema.sql`, in their own
  `-- @section seed` block, with placeholder picsum.photos covers.

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
is for setup scripts ONLY — never import it anywhere in the app.

### How db-setup works

`npm run db:setup` → `scripts/db-setup.js` (uses the `pg` package, SSL with
`rejectUnauthorized: false`):

1. Reads `SUPABASE_DB_URL` from `.env` and builds a list of candidates from it:
   the saved URL, the direct host (`db.<ref>.supabase.co:5432`, IPv6-only), then
   the session poolers `aws-1-ap-southeast-1` and `aws-0-ap-southeast-1` on
   5432, then the transaction pooler on 6543. No password is hardcoded in the
   script.
2. Uses the first that connects and writes it back to `.env`
   (**`aws-0-ap-southeast-1` on 5432 is the one that works** for this project).
3. Splits `schema.sql` on its `-- @section <name>` markers and runs each section
   as one transaction. A permission error in a storage section is skipped with
   a note; any other error stops the run.
4. Verifies: the six tables exist with RLS on and four policies each, the
   destination rows, and the bucket + its policies.

If all connections fail it stops and asks for the "Session pooler" string from
the Supabase dashboard's Connect button.

- `npm run db:verify` — step 4 only, changes nothing.
- `npm run db:test` — `scripts/verify-crud.mjs` (run with `tsx`): imports the
  app's real repositories and form logic and exercises them against the live
  project with the publishable key. Run it after touching the data layer or
  the schema.

**`db:setup` is destructive**: it replaces all destinations with the seeds.

## Conventions

- **Strict TypeScript.** `npx tsc --noEmit` and `npx expo lint` must both pass
  before a task is done.
- **Repository pattern.** Screens and components never call supabase-js.
  - `src/lib/supabase.ts` — the one client.
  - `src/repositories/destinations.ts`, `destinationImages.ts` — factories that
    take a client, so Node scripts can reuse them. Keep them (and
    `src/lib/destinationForm.ts`, `base64.ts`, `errors.ts`,
    `src/constants/taxonomy.ts`) free of React Native imports.
  - `src/repositories/index.ts` — binds the factories to the app client.
    Import repositories from `@/repositories`.
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
  lib/                 supabase, errors, destinationForm, coverPhoto, base64, format
  repositories/        Data access
  theme/               Design tokens + Paper and navigation themes
  types/               database.ts
supabase/schema.sql
scripts/               db-setup.js, verify-crud.mjs
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

## Rules

- **Stay Expo Go compatible.** No native modules or config plugins that need a
  development build. Before adding a library, confirm it ships in Expo Go.
- **Never hardcode secrets.** Keys come from `.env`; `.env` is never committed.
- **Keep seed data replaceable.** Seeds stay in their own section of
  `schema.sql`; nothing in the app may depend on a specific seed row.
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

Next

- [ ] Full 25-destination dataset + real photos (replace the 6 placeholder seeds)
- [ ] Virtual Tour mode (history, cultural significance, photo gallery from `destination_images`)
- [ ] Quiz engine (per-destination multiple choice, auto-scoring)
- [ ] Progress tracking (quiz scores + completed destinations, by device id)
- [ ] Google Maps (`react-native-maps`) using the stored coordinates
- [ ] Final polish + EAS APK

## Not yet verified on a device

Phase 1 was checked with `tsc`, ESLint, an Android Metro bundle, the live
database script, and a click-through of every flow in the web build. It has
**not** been run on a physical Android phone by the agent. The parts that only a
phone can confirm: the photo picker and upload, keyboard avoidance in the form,
and status-bar / navigation-bar insets.
