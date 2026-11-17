# Virtual Tour and Cultural Mapping App

A mobile app for exploring the major tourist destinations and cultural heritage
sites of **Region IV-A (CALABARZON), Philippines** — Cavite, Laguna, Batangas,
Rizal and Quezon — as an alternative to educational field trips.

School project for **WMA 306 — UI/UX and Cross-Platform Applications**.

Built with Expo (SDK 58) + TypeScript, Expo Router, React Native Paper and
Supabase. It runs entirely inside **Expo Go** — no native build needed.

## What it does

The app opens on a **Welcome** screen: create an account, sign in with email
and password, or **continue as a guest**. Guests get every feature — an
account only means your progress follows your email to another phone. The
four tabs are **Home, Explore, Map and Progress**.

| Screen | What you can do |
| --- | --- |
| **Home** | See the app intro, search (jumps to Explore), swipe the Featured carousel, and tap a category or province to open Explore pre-filtered. |
| **Explore** | Search as you type by name or town, combine a category filter with a province filter, pull down to refresh. The **Add** button adds a new destination. |
| **Map** | All 26 destinations on Google Maps, coloured by category. Tap a legend chip to show one category; tap a pin for its name and category, then open its page. |
| **Progress** | Who you are signed in as (or Guest), how many of the 26 destinations you have visited, quizzes taken, average and best score, progress per province, and your journey so far. |
| **Details** | Photo, address, category and province, description, a small map, History and Cultural Significance. **Start Virtual Tour** and **Quiz** sit at the bottom; Edit and Delete are under "Manage this entry". |
| **Virtual Tour** | A full-screen, museum-style walk-through: introduction → photo gallery (with credits) → History → Cultural Significance → "Mark as Visited" → on to the quiz. |
| **Quiz** | Five multiple-choice questions, answers shuffled every time. Each answer is marked right (green) or wrong (terracotta) straight away; the score screen shows X/5 and a percentage. Retake as often as you like — your best score is kept. |
| **Add / Edit** | One shared form with validation, dropdowns for category and province, optional coordinates, and a photo picker that resizes to 1600px and uploads to Supabase Storage. |

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
GOOGLE_MAPS_ANDROID_API_KEY=
```

- The two `EXPO_PUBLIC_` values are bundled into the app. The publishable key
  is safe to ship: it maps to the database's `anon` role (or `authenticated`
  once someone signs in).
- `SUPABASE_DB_URL` is used **only** by the setup and test scripts. App code
  never reads it. `.env` is git-ignored — never commit it.
- `GOOGLE_MAPS_ANDROID_API_KEY` can stay empty: Expo Go shows Google Maps with
  its own key. It is needed only for a standalone Android build (APK).

### Accounts: one setting to change

Email sign-up works best with **"Confirm email" turned off** in the Supabase
dashboard: **Authentication → Sign In / Providers → Email → Confirm email →
off**. While it is on, new users must click a link in an email before they can
sign in, and Supabase's built-in email service only sends a few emails per
hour, so most sign-ups would fail. Guests are not affected.

Restart `npx expo start` after changing `.env`.

## Content: 26 destinations

The app ships with a complete dataset of 26 major CALABARZON destinations —
5 in Cavite, 6 in Laguna, 5 in Batangas, 5 in Rizal and 5 in Quezon. Each has a
short description, a history, a note on its cultural significance, a verified
address and coordinates, three photos, and a five-question quiz.

It all lives in one reviewable file, `data/destinations-seed.json`, together
with the sources each entry was checked against and a list of the claims that
were deliberately softened ("often cited as…") because sources disagree.

**Photos** come only from [Wikimedia Commons](https://commons.wikimedia.org),
under public-domain, CC0, CC BY or CC BY-SA terms. The resized copies are in
`data/images/`, and `data/IMAGE_CREDITS.md` lists the author and licence of
every one. In the app, the credit is shown on each destination's page.

## Database

- `supabase/schema.sql` creates the structure: six tables, Row Level Security
  policies and the public `destination-images` storage bucket.
- `data/destinations-seed.json` is the content that gets loaded into it.

| Command | What it does |
| --- | --- |
| `npm run db:setup` | **Full reset.** Recreates the tables, then loads the 26 destinations with their photos and quizzes, then verifies. Destinations added from the app are removed. |
| `npm run db:seed` | Reloads the 26 destinations without recreating the tables. Safe to run repeatedly. |
| `npm run db:verify` | Checks the live database without changing anything: 26 destinations, each with a cover photo, 3 photo rows and 5 valid quiz questions, and that photo links work. |
| `npm run db:test` | Exercises the app's real data layer against the live project (read, search, filters, create, update, delete, photo upload, quiz questions, quiz attempts and best scores, visited destinations, the Progress summary) and cleans up after itself. |
| `npm run auth:test` | Checks sign-in, sign-out, friendly error messages and that a signed-in user can read and save progress, with a temporary test account that it deletes again. |
| `npm test` | Unit tests for the quiz scorer, answer shuffling, progress statistics and form validation. |
| `npm run data:check` | Validates the dataset file offline, including that every quiz answer can be found in that destination's own text. |
| `npm run images:fetch` | Downloads and resizes any photo named in the dataset that is missing from `data/images`. |
| `npm run images:find` | Helper for choosing photos: builds a contact sheet of usable Commons images. |

The setup scripts connect with `SUPABASE_DB_URL`. Supabase's direct database
host is IPv6-only, so if the saved address stops working the script tries the
IPv4 connection poolers and saves the one that works back into `.env`.

## Project layout

```
src/
  app/                 Screens (Expo Router — each file is a route)
                       welcome, sign-in, sign-up, add
    (tabs)/            Home, Explore, Map, Progress
    destination/[id]/  Details, Edit, Virtual Tour, Quiz
  components/          Reusable UI (cards, chips, form fields, states)
  constants/           Provinces and categories
  context/             Small shared state: filters, data refresh, toasts, who is signed in
  hooks/               Data-loading hooks
  lib/                 Supabase client, quiz scoring, progress stats, form logic, helpers
  repositories/        The only code that talks to Supabase
  theme/               Design tokens: colours, type, spacing
  types/               Handwritten database types
data/
  destinations-seed.json   The content: 26 destinations, photos, quizzes
  images/                  Processed photos, one folder per destination
  IMAGE_CREDITS.md         Author and licence of every photo
supabase/schema.sql    Database structure
scripts/               Setup, seeding, verification and photo tools
tests/                 Unit tests
```

## Checks

```bash
npm run typecheck   # TypeScript, strict
npm run lint        # ESLint (Expo config)
npm test            # unit tests (quiz scorer, progress, validation)
npm run data:check  # the dataset file
npm run db:verify   # the live database holds the full dataset
npm run db:test     # data layer against the live database
npm run auth:test   # sign-in and signed-in progress against the live project
```

## Known limitations

- Security is deliberately open for this school project: anyone using the app
  can add, edit and delete destinations, and progress rows are not locked to
  their owner in the database. `supabase/schema.sql` explains how a real
  deployment would restrict them. Running `npm run db:seed` restores the
  original 26 destinations.
- Guests' progress lives on that phone (a random id stored by the app).
  Uninstalling the app loses it; signing up first keeps it.
- In the web preview the map is a simple schematic — Google Maps itself only
  runs in the phone app.
