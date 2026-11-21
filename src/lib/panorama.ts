/**
 * In-app 360° panoramas (Run 8) — the Maps Embed API Street View URL, the
 * rule for when the tour shows its "360° View" step, and the signals used to
 * tell a real panorama from Google's "no imagery" state. Pure (no React
 * Native imports): unit-tested in Node and reused by the build-time curation
 * script (scripts/curate-panoramas.mjs).
 *
 * Key: EXPO_PUBLIC_MAPS_EMBED_KEY. It is publishable on purpose — it is
 * API-restricted to the Maps Embed API, which is free at any volume. The
 * Android Maps SDK key (GOOGLE_MAPS_ANDROID_API_KEY) must NEVER appear in a
 * WebView URL.
 */
import { hasCoordinates } from '@/lib/mapRegion';

export const EMBED_STREETVIEW_BASE = 'https://www.google.com/maps/embed/v1/streetview';
/** Metres around the destination in which Google may pick the nearest panorama. */
export const PANORAMA_RADIUS_M = 250;
/** Horizontal field of view, degrees. */
export const PANORAMA_FOV = 90;
/**
 * How long the in-app view waits for Google's place card before it decides
 * there is no imagery (user-added destinations are shown optimistically).
 */
export const PANORAMA_DETECT_MS = 9000;

/** The embed key the app was built with ('' when missing). */
export function embedKeyFromEnv(env: Record<string, string | undefined> = process.env): string {
  return (env.EXPO_PUBLIC_MAPS_EMBED_KEY ?? '').trim();
}

/**
 * `https://www.google.com/maps/embed/v1/streetview?key=…&location=<lat>,<lng>&radius=250&fov=90`.
 * Returns null without a key or usable coordinates.
 */
export function panoramaEmbedUrl(
  place: { latitude: number | null; longitude: number | null },
  key: string,
  options: { radius?: number; fov?: number } = {},
): string | null {
  if (!key || !hasCoordinates(place)) return null;
  const lat = Number(place.latitude.toFixed(6));
  const lng = Number(place.longitude.toFixed(6));
  const params = [
    `key=${encodeURIComponent(key)}`,
    `location=${lat},${lng}`,
    `radius=${options.radius ?? PANORAMA_RADIUS_M}`,
    `fov=${options.fov ?? PANORAMA_FOV}`,
  ];
  return `${EMBED_STREETVIEW_BASE}?${params.join('&')}`;
}

/**
 * The Embed API refuses to load as a top-level page ("The Google Maps Embed
 * API must be used in an iframe"), so the native WebView loads this small
 * page that frames it full-bleed. `background` paints the frame while the
 * panorama loads (the exhibit wall colour).
 */
export function panoramaHtml(url: string, background: string, title: string): string {
  const safe = (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  return [
    '<!doctype html><html><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">',
    `<style>html,body{margin:0;height:100%;overflow:hidden;background:${safe(background)}}iframe{border:0;width:100%;height:100%;display:block}</style>`,
    '</head><body>',
    `<iframe src="${safe(url)}" title="${safe(title)}" allowfullscreen referrerpolicy="no-referrer-when-downgrade"></iframe>`,
    '</body></html>',
  ].join('');
}

/**
 * Should the tour offer its 360° step?
 *   has_panorama === true  → curated: a panorama exists → yes
 *   has_panorama === false → curated: no imagery → no
 *   null / undefined       → not curated (added in the app) → yes, optimistically;
 *                            the view itself shows a fallback when Google has no imagery.
 * Never offline, never without coordinates or a key.
 */
export function showsPanoramaStep(
  destination: { latitude: number | null; longitude: number | null; has_panorama?: boolean | null },
  context: { offline: boolean; key: string },
): boolean {
  if (context.offline || !context.key || !hasCoordinates(destination)) return false;
  return destination.has_panorama !== false;
}

/** A curated destination (true / false), as opposed to one added in the app (null). */
export function isCurated(destination: { has_panorama?: boolean | null }): boolean {
  return typeof destination.has_panorama === 'boolean';
}

/**
 * What a probe of the embed page saw. Google's embed shows a place card
 * ("<town>, Calabarzon · View on Google Maps") over a real panorama; over
 * "no imagery" it shows a black canvas with only the controls and
 * "Image may be subject to copyright".
 */
export type EmbedProbe = { hasPlaceCard: boolean; darkRatio: number | null; text: string };

/** The decision: a place card, and (when a pixel sample exists) not an all-black frame. */
export function classifyEmbedProbe(probe: EmbedProbe): boolean {
  if (!probe.hasPlaceCard) return false;
  if (probe.darkRatio !== null && probe.darkRatio > 0.9) return false;
  return true;
}

/**
 * Runs inside the embed frame (the curation script): reports whether
 * Google's place card appeared. The app cannot read the cross-origin frame,
 * so for destinations that were not curated it shows a gentle "no imagery?"
 * note after PANORAMA_DETECT_MS instead of detecting.
 */
export const PLACE_CARD_PROBE = `(function () {
  var text = (document.body && document.body.innerText) || '';
  var link = Array.prototype.some.call(document.querySelectorAll('a'), function (a) {
    return /maps\\.google\\.|google\\.[a-z.]+\\/maps/.test(a.href || '') && /View on Google Maps|Google Maps/i.test(a.textContent || '');
  });
  return { hasPlaceCard: link || /View on Google Maps/i.test(text), text: text.slice(0, 400) };
})()`;

export type CurationRow = {
  slug: string;
  name: string;
  province: string;
  has_panorama: boolean;
  place_label: string | null;
};

/** Checks the curation output before it is written to the dataset. */
export function validateCuration(rows: readonly CurationRow[], expectedSlugs: readonly string[]): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.slug)) problems.push(`duplicate ${row.slug}`);
    seen.add(row.slug);
    if (typeof row.has_panorama !== 'boolean') problems.push(`${row.slug}: has_panorama is not a boolean`);
    if (!expectedSlugs.includes(row.slug)) problems.push(`unknown slug ${row.slug}`);
  }
  for (const slug of expectedSlugs) if (!seen.has(slug)) problems.push(`missing ${slug}`);
  return problems;
}
