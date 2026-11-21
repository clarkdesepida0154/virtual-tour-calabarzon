/**
 * Captures the certificate as a PNG (react-native-view-shot, included in
 * Expo Go) and opens the native share sheet (Run 6). Works offline.
 *
 * - iOS: the image itself goes to the share sheet (`Share` takes a file URL).
 * - Android: React Native's `Share` can only carry text, and this run adds no
 *   other native module, so Android shares a short text message instead of
 *   the image (the capture still runs, so a later file-sharing module can
 *   reuse it). See CLAUDE.md, Run 6.
 *
 * The web build uses certificateShare.web.ts: view-shot's web capture needs
 * an extra library (html2canvas-pro) that the app does not ship.
 */
import type { ComponentRef, RefObject } from 'react';
import { Platform, Share } from 'react-native';
import type { View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

export type CertificateShareOutcome = 'shared' | 'dismissed' | 'unavailable';

export async function shareCertificateImage(
  view: RefObject<ComponentRef<typeof View> | null>,
  text: { title: string; message: string },
): Promise<CertificateShareOutcome> {
  try {
    if (!view.current) return 'unavailable';
    const uri = await captureRef(view, { format: 'png', quality: 1, result: 'tmpfile' });
    const content = Platform.OS === 'ios' ? { url: uri, title: text.title } : { title: text.title, message: text.message };
    const result: { action?: string } | undefined = await Share.share(content, { dialogTitle: text.title });
    return result?.action === Share.dismissedAction ? 'dismissed' : 'shared';
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') return 'dismissed';
    return 'unavailable';
  }
}
