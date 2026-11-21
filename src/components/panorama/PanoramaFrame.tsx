/**
 * The 360° panorama surface (native, Run 8): a full-bleed
 * react-native-webview (in Expo Go) loading a tiny page that frames the
 * Maps Embed API Street View — the Embed API refuses top-level loads. Drag
 * / pinch to look around happens inside Google's viewer. The web twin
 * (PanoramaFrame.web.tsx) renders the same iframe directly.
 */
import { StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

import { openExternalUrl } from '@/lib/device';
import { panoramaHtml } from '@/lib/panorama';
import { useAppTheme } from '@/theme/ThemeProvider';

import type { PanoramaFrameProps } from './types';

/** A stable https origin for the framing page (the key is API-restricted, not referrer-restricted). */
const BASE_URL = 'https://clarkdesepida0154.github.io/virtual-tour-calabarzon/';

export function PanoramaFrame({ url, title, onLoaded, onFailed }: PanoramaFrameProps) {
  const { colors } = useAppTheme();
  return (
    <WebView
      originWhitelist={['https://*']}
      source={{ html: panoramaHtml(url, colors.exhibit, title), baseUrl: BASE_URL }}
      style={[StyleSheet.absoluteFill, { backgroundColor: colors.exhibit }]}
      containerStyle={{ backgroundColor: colors.exhibit }}
      javaScriptEnabled
      domStorageEnabled
      allowsInlineMediaPlayback
      setSupportMultipleWindows={false}
      scrollEnabled={false}
      bounces={false}
      overScrollMode="never"
      nestedScrollEnabled
      onLoadEnd={onLoaded}
      onError={onFailed}
      onHttpError={onFailed}
      // Google's own links ("View on Google Maps") open outside the app
      // instead of navigating the framing page away.
      onShouldStartLoadWithRequest={(request) => {
        const own =
          request.isTopFrame === false ||
          request.url.startsWith('about:') ||
          request.url.startsWith(BASE_URL) ||
          request.url.includes('/maps/embed/');
        if (!own && request.url.startsWith('https://')) void openExternalUrl(request.url);
        return own;
      }}
      accessibilityLabel={title}
    />
  );
}
