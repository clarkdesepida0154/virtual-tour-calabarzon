/**
 * The Maps Embed API key bundled into the app (Run 8). Metro inlines
 * `process.env.EXPO_PUBLIC_*` only for this literal member access, so the
 * key is read here and nowhere else. Publishable by design: API-restricted
 * to the Maps Embed API (free at any volume). See src/lib/panorama.ts.
 */
export const MAPS_EMBED_KEY = (process.env.EXPO_PUBLIC_MAPS_EMBED_KEY ?? '').trim();
