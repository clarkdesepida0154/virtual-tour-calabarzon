/** Pure share flow for the certificate (no React Native imports, unit-tested). */
export type CertificateShareOutcome = 'shared' | 'dismissed' | 'unavailable';

export interface CertificateSharer {
  isAvailable: () => Promise<boolean>;
  shareFile: (uri: string, title: string) => Promise<void>;
  shareText: (text: { title: string; message: string }) => Promise<'shared' | 'dismissed'>;
}

/** Image first (capture → share the file); the text message only when file sharing is unavailable. */
export async function shareCertificate(
  capture: () => Promise<string>,
  text: { title: string; message: string },
  sharer: CertificateSharer,
): Promise<CertificateShareOutcome> {
  try {
    if (await sharer.isAvailable()) {
      const uri = await capture();
      await sharer.shareFile(uri, text.title);
      return 'shared';
    }
    return await sharer.shareText(text);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') return 'dismissed';
    return 'unavailable';
  }
}
