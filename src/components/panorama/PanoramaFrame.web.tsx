/**
 * Web twin of PanoramaFrame.tsx (Run 8): react-native-webview has no web
 * implementation, so the browser frames the Maps Embed API directly.
 * Limited on web only by what the browser allows inside an iframe.
 */
import { createElement } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAppTheme } from '@/theme/ThemeProvider';

import type { PanoramaFrameProps } from './types';

export function PanoramaFrame({ url, title, onLoaded, onFailed }: PanoramaFrameProps) {
  const { colors } = useAppTheme();
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.exhibit }]}>
      {createElement('iframe', {
        src: url,
        title,
        allowFullScreen: true,
        referrerPolicy: 'no-referrer-when-downgrade',
        onLoad: onLoaded,
        onError: onFailed,
        'data-testid': 'panorama-frame',
        style: { border: 0, width: '100%', height: '100%', display: 'block', backgroundColor: colors.exhibit },
      })}
    </View>
  );
}
