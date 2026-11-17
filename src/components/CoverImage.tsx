import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { AppIcon } from '@/components/AppIcon';
import type { IconSizeToken } from '@/theme';
import { colors, motion } from '@/theme';

type Props = {
  uri: string | null | undefined;
  /** Describes the photo for screen readers. */
  label: string;
  style?: StyleProp<ViewStyle>;
  fallbackIconSize?: IconSizeToken;
};

/**
 * A destination photo. Shows a warm placeholder tone while loading and a
 * quiet "no photo" mark when there is no image or it fails to load.
 */
export function CoverImage({ uri, label, style, fallbackIconSize = 'xl' }: Props) {
  // Remember which URL failed, so a new URL gets a fresh attempt.
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const showFallback = !uri || failedUri === uri;

  return (
    <View style={[styles.frame, style]}>
      {showFallback ? (
        <View style={styles.fallback} accessible accessibilityLabel={`${label} — no photo`}>
          <AppIcon name="image-off-outline" size={fallbackIconSize} color="muted" />
        </View>
      ) : (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={motion.normal}
          cachePolicy="memory-disk"
          recyclingKey={uri}
          accessibilityLabel={label}
          onError={() => setFailedUri(uri)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    backgroundColor: colors.surfaceMuted,
    overflow: 'hidden',
  },
  fallback: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
