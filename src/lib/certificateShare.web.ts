/**
 * Web stand-in for certificateShare.ts: no image capture in the browser
 * build (view-shot's web capture needs html2canvas-pro, which the app does
 * not ship). The browser's share sheet gets the text, when it has one.
 */
import type { ComponentRef, RefObject } from 'react';
import { Share } from 'react-native';
import type { View } from 'react-native';

export type CertificateShareOutcome = 'shared' | 'dismissed' | 'unavailable';

export async function shareCertificateImage(
  _view: RefObject<ComponentRef<typeof View> | null>,
  text: { title: string; message: string },
): Promise<CertificateShareOutcome> {
  try {
    await Share.share({ title: text.title, message: text.message });
    return 'shared';
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') return 'dismissed';
    return 'unavailable';
  }
}
