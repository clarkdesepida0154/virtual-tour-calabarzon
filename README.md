# Virtual Tour and Cultural Mapping App

A mobile app for exploring the major tourist destinations and cultural heritage
sites of **Region IV-A (CALABARZON), Philippines** — Cavite, Laguna, Batangas,
Rizal and Quezon — as an alternative to educational field trips.

School project for **WMA 306 — UI/UX and Cross-Platform Applications**.

Built with Expo (SDK 58) + TypeScript, Expo Router, React Native Paper and
Supabase. It runs entirely inside **Expo Go** — no native build needed.

## What it does (Phase 1)

| Screen | What you can do |
| --- | --- |
| **Home** | See the app intro, search (jumps to Explore), swipe the Featured carousel, and tap a category or province to open Explore pre-filtered. |
| **Explore** | Search as you type by name or town, combine a category filter with a province filter, pull down to refresh. |
| **Details** | Full-width photo, address, category and province, description, plus History and Cultural Significance when they are filled in. Edit or delete (with confirmation). |
| **Add / Edit** | One shared form with validation, dropdowns for category and province, optional coordinates, and a photo picker that resizes to 1600px and uploads to Supabase Storage. |

Phase 2 (virtual tour mode, quizzes, progress tracking, maps) is not built yet,
but the database already has the tables for it. See `CLAUDE.md` for the roadmap.

## Run it on your Android phone

You need [Node.js](https://nodejs.org) 20 or newer on the computer, and the
**Expo Go** app from the Play Store on the phone.

```bash
cd virtual-tour-app
npm install
npx expo start
```

1. Put the phone and the computer on the **same Wi-Fi network**.
2. Open **Expo Go** on the phone and tap **Scan QR code**.
3. Scan the QR code shown in the terminal. The app loads in a few seconds.

If the phone cannot connect:

- Allow Node.js through Windows Firewall when Windows asks (private networks).
- Some school or public Wi-Fi networks block device-to-device traffic. Use a
  phone hotspot, or run `npx expo start --tunnel` instead.
- In Expo Go you can also type the address by hand: **Enter URL manually** →
  `exp://<your-computer-ip>:8081`.

## Configuration

The app reads two values from `.env` (copy `.env.example` to create it):

```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_DB_URL=
```

- The two `EXPO_PUBLIC_` values are bundled into the app. The publishable key
  is safe to ship: it maps to the database's `anon` role.
- `SUPABASE_DB_URL` is used **only** by the setup script below. App code never
  reads it. `.env` is git-ignored — never commit it.

Restart `npx expo start` after changing `.env`.

## Database

Everything about the database lives in one file, `supabase/schema.sql`: the six
tables, Row Level Security policies, the public `destination-images` storage
bucket, and six sample destinations.

| Command | What it does |
| --- | --- |
| `npm run db:setup` | Runs `schema.sql` against Supabase, then verifies it. **This resets the data** — every destination is replaced by the six samples. |
| `npm run db:verify` | Checks the tables, policies, bucket and row count without changing anything. |
| `npm run db:test` | Exercises the app's real data layer against the live project (create, read, update, delete, search, filters, photo upload) and cleans up after itself. |

`db:setup` connects with `SUPABASE_DB_URL`. Supabase's direct database host is
IPv6-only, so if it is unreachable the script automatically tries the IPv4
connection poolers and saves the one that works back into `.env`.

## Project layout

```
src/
  app/                 Screens (Expo Router — each file is a route)
    (tabs)/            Home, Explore, Add
    destination/[id]/  Details and Edit
  components/          Reusable UI (cards, chips, form fields, states)
  constants/           Provinces and categories
  context/             Small shared state: filters, data refresh, toasts
  hooks/               Data-loading hooks
  lib/                 Supabase client, form logic, helpers
  repositories/        The only code that talks to Supabase
  theme/               Design tokens: colours, type, spacing
  types/               Handwritten database types
supabase/schema.sql    Database schema + seed data
scripts/               db-setup.js, verify-crud.mjs
```

## Checks

```bash
npm run typecheck   # TypeScript, strict
npm run lint        # ESLint (Expo config)
npm run db:test     # data layer against the live database
```

## Known limitations

- The six sample destinations use **placeholder photos** from picsum.photos.
  They are not pictures of the real places. The full 25-destination dataset
  with real photos comes in the next iteration.
- No map yet — coordinates are stored and shown as text only.
- Virtual tour mode, quizzes and progress tracking (Phase 2) are not built.
- There is no sign-in: anyone using the app can add, edit and delete
  destinations. That is intentional for this school project.
