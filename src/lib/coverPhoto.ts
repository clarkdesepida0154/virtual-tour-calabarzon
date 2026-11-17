/**
 * Picking and preparing a cover photo on the device.
 *
 * Flow: system photo picker → resize so the longest side is at most 1600px →
 * JPEG. The result carries Base64 because that is what gets uploaded
 * (see src/lib/base64.ts). All modules used here ship with Expo Go.
 */
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

export const COVER_MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.8;
/** Decode cap: keeps huge camera photos from exhausting memory before the resize. */
const DECODE_LIMIT = COVER_MAX_DIMENSION * 2;

export type PreparedPhoto = {
  /** Local file, for the on-screen preview. */
  uri: string;
  /** JPEG bytes as Base64, ready to upload. */
  base64: string;
  width: number;
  height: number;
};

export async function prepareCoverPhoto(sourceUri: string): Promise<PreparedPhoto> {
  const context = ImageManipulator.manipulate(sourceUri, {
    maxWidth: DECODE_LIMIT,
    maxHeight: DECODE_LIMIT,
  });

  // Render once to learn the real (orientation-corrected) size.
  const original = await context.renderAsync();
  const longestSide = Math.max(original.width, original.height);
  if (longestSide > COVER_MAX_DIMENSION) {
    context.resize(
      original.width >= original.height
        ? { width: COVER_MAX_DIMENSION }
        : { height: COVER_MAX_DIMENSION },
    );
  }

  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({
    format: SaveFormat.JPEG,
    compress: JPEG_QUALITY,
    base64: true,
  });
  if (!saved.base64) {
    throw new Error('The photo could not be prepared for upload.');
  }

  return { uri: saved.uri, base64: saved.base64, width: saved.width, height: saved.height };
}

/** Opens the photo library. Resolves to `null` when the user backs out. */
export async function pickCoverPhoto(): Promise<PreparedPhoto | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: false,
    quality: 1,
  });
  if (result.canceled) return null;

  const asset = result.assets[0];
  if (!asset) return null;
  return prepareCoverPhoto(asset.uri);
}
