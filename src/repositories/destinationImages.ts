/**
 * Destination photos repository — uploads to and removals from the public
 * `destination-images` Storage bucket.
 *
 * A factory, like ./destinations.ts, so Node scripts can reuse it. Keep it
 * free of React Native imports.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

import { toAppError } from '@/lib/errors';
import type { Database } from '@/types/database';

export const DESTINATION_IMAGES_BUCKET = 'destination-images';

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

  /** Uploads a JPEG and returns its public URL. */
  async function uploadCover(jpeg: ArrayBuffer): Promise<string> {
    const path = `${COVERS_FOLDER}/${uniqueFileName('jpg')}`;
    const { error } = await bucket().upload(path, jpeg, {
      contentType: 'image/jpeg',
      cacheControl: CACHE_SECONDS,
      upsert: false,
    });
    if (error) throw toAppError(error, 'We couldn’t upload the photo.');
    return bucket().getPublicUrl(path).data.publicUrl;
  }

  /**
   * Deletes a previously uploaded photo. Best-effort clean-up: URLs that are
   * not in our bucket (e.g. seed placeholders) are ignored, and failures are
   * swallowed because a leftover file must never block the user's action.
   */
  async function removeByPublicUrl(url: string | null | undefined): Promise<boolean> {
    const path = storagePathFromPublicUrl(url);
    if (!path) return false;
    try {
      const { error } = await bucket().remove([path]);
      return !error;
    } catch {
      return false;
    }
  }

  return { uploadCover, removeByPublicUrl };
}

export type DestinationImagesRepository = ReturnType<typeof createDestinationImagesRepository>;
