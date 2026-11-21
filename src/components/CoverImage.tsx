import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { AppIcon } from '@/components/AppIcon';
import type { IconSizeToken } from '@/theme';
import { motion } from '@/theme';
import { makeStyles } from '@/theme/ThemeProvider';
import { useI18n } from '@/context/I18nContext';

type Props = {
  uri: string | null | undefined;
  /** Describes the photo for screen readers. */
  label: string;
  style?: StyleProp<ViewStyle>;
  fallbackIconSize?: IconSizeToken;
  /** `contain` shows the whole photo (tour gallery); default `cover` fills the frame. */
  fit?: 'cover' | 'contain';
};

/**
 * A destination photo. Shows a warm placeholder tone while loading and a
 * quiet "no photo" mark when there is no image or it fails to load.
 */
export function CoverImage({ uri, label, style, fallbackIconSize = 'xl', fit = 'cover' }: Props) {
  const styles = useStyles();
  const { t } = useI18n();
  // Remember which URL failed, so a new URL gets a fresh attempt.
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const showFallback = !uri || failedUri === uri;

  return (
    <View style={[styles.frame, style]}>
      {showFallback ? (
        <View style={styles.fallback} accessible accessibilityLabel={t('common.noPhoto', { label })}>
          <AppIcon name="image-off-outline" size={fallbackIconSize} color="muted" />
        </View>
      ) : (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit={fit}
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

const useStyles = makeStyles(({ colors }) => ({
  frame: {
    backgroundColor: colors.surfaceMuted,
    overflow: 'hidden',
  },
  fallback: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
