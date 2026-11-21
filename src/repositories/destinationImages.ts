/**
 * Destination photos repository.
 *
 * Two things live here:
 *   - the files, in the public `destination-images` Storage bucket;
 *   - the `destination_images` rows, which list a destination's photos in
 *     order (row 0 is the cover) together with each photo's credit line.
 *
 * A factory, like ./destinations.ts, so Node scripts can reuse it. Keep it
 * free of React Native imports.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

import { toAppError } from '@/lib/errors';
import type { Database, DestinationImage } from '@/types/database';

export const DESTINATION_IMAGES_BUCKET = 'destination-images';

const TABLE = 'destination_images';
const COVERS_FOLDER = 'covers';
const PUBLIC_PATH_MARKER = `/storage/v1/object/public/${DESTINATION_IMAGES_BUCKET}/`;
/** Uploaded photos never change (each upload gets a new name), so cache for a year. */
const CACHE_SECONDS = '31536000';

function uniqueFileName(extension: string): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `${Date.now()}-${random}.${extension}`;
}

/** The object path inside our bucket, or `null` for any URL we do not own. */
export function storagePathFromPublicUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const index = url.indexOf(PUBLIC_PATH_MARKER);
  if (index === -1) return null;
  const path = url.slice(index + PUBLIC_PATH_MARKER.length).split('?')[0];
  return path ? decodeURIComponent(path) : null;
}

export function createDestinationImagesRepository(client: SupabaseClient<Database>) {
  const bucket = () => client.storage.from(DESTINATION_IMAGES_BUCKET);

  /** Uploads a JPEG picked in the app and returns its public URL. */
  async function uploadCover(jpeg: ArrayBuffer): Promise<string> {
    const path = `${COVERS_FOLDER}/${uniqueFileName('jpg')}`;
    const { error } = await bucket().upload(path, jpeg, {
      contentType: 'image/jpeg',
      cacheControl: CACHE_SECONDS,
      upsert: false,
    });
    if (error) throw toAppError(error, 'uploadPhoto');
    return bucket().getPublicUrl(path).data.publicUrl;
  }

  /**
   * Deletes stored photos by their public URLs. Best-effort clean-up: URLs
   * outside our bucket are ignored, and failures are swallowed because a
   * leftover file must never block the user's action. Returns how many files
   * were asked to be removed.
   */
  async function removeFilesByPublicUrl(urls: readonly (string | null | undefined)[]): Promise<number> {
    const paths = [...new Set(urls.map(storagePathFromPublicUrl))].filter(
      (path): path is string => path !== null,
    );
    if (paths.length === 0) return 0;
    try {
      const { error } = await bucket().remove(paths);
      return error ? 0 : paths.length;
    } catch {
      return 0;
    }
  }

  /** Single-URL convenience over `removeFilesByPublicUrl`. */
  async function removeByPublicUrl(url: string | null | undefined): Promise<boolean> {
    return (await removeFilesByPublicUrl([url])) > 0;
  }

  /** A destination's photos in display order: the cover first, then the gallery. */
  async function listForDestination(destinationId: string): Promise<DestinationImage[]> {
    const { data, error } = await client
      .from(TABLE)
      .select('*')
      .eq('destination_id', destinationId)
      .order('sort_order', { ascending: true });
    if (error) throw toAppError(error, 'loadPhotos');
    return data;
  }

  /** Every photo row of every destination (for the Photo Credits screen). */
  async function listAll(): Promise<DestinationImage[]> {
    const { data, error } = await client
      .from(TABLE)
      .select('*')
      .order('destination_id', { ascending: true })
      .order('sort_order', { ascending: true });
    if (error) throw toAppError(error, 'loadCredits');
    return data;
  }

  /**
   * Forgets a photo that a destination no longer uses (for example its old
   * cover after a new one was picked), so the gallery never points at a
   * deleted file. Best-effort, like the file clean-up.
   */
  async function removeRecordByUrl(destinationId: string, imageUrl: string): Promise<void> {
    try {
      await client.from(TABLE).delete().eq('destination_id', destinationId).eq('image_url', imageUrl);
    } catch {
      // A stale row is harmless compared with failing the user's save.
    }
  }

  return {
    uploadCover,
    removeByPublicUrl,
    removeFilesByPublicUrl,
    listForDestination,
    listAll,
    removeRecordByUrl,
  };
}

export type DestinationImagesRepository = ReturnType<typeof createDestinationImagesRepository>;
