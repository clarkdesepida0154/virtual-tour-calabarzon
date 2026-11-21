/**
 * Captures the certificate as a PNG (react-native-view-shot) and hands the
 * image to the native share sheet through expo-sharing — the same on iOS and
 * Android (Run 7). Works offline. When file sharing is unavailable the text
 * message is shared instead.
 *
 * The web build uses certificateShare.web.ts: view-shot's web capture needs
 * an extra library (html2canvas-pro) that the app does not ship.
 */
import type { ComponentRef, RefObject } from 'react';
import { Share } from 'react-native';
import type { View } from 'react-native';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';
import { shareCertificate, type CertificateSharer, type CertificateShareOutcome } from './certificateShareFlow';

export type { CertificateShareOutcome } from './certificateShareFlow';

const nativeSharer: CertificateSharer = {
  isAvailable: () => Sharing.isAvailableAsync(),
  shareFile: (uri, title) => Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: title, UTI: 'public.png' }),
  shareText: async (text) => {
    const result: { action?: string } | undefined = await Share.share({ title: text.title, message: text.message });
    return result?.action === Share.dismissedAction ? 'dismissed' : 'shared';
  },
};

export function shareCertificateImage(
  view: RefObject<ComponentRef<typeof View> | null>,
  text: { title: string; message: string },
): Promise<CertificateShareOutcome> {
  return shareCertificate(async () => {
    if (!view.current) throw new Error('No certificate to capture');
    return captureRef(view, { format: 'png', quality: 1, result: 'tmpfile' });
  }, text, nativeSharer);
}
