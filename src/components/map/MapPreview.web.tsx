/**
 * Web stand-in for the Details map preview (react-native-maps has no web
 * support): a quiet survey-sheet tile with a single pin in the middle.
 */
import { StyleSheet, View } from 'react-native';

import { AppIcon } from '@/components/AppIcon';
import { layout, spacing } from '@/theme';
import { makeStyles } from '@/theme/ThemeProvider';

import type { MapPreviewProps } from './types';

export function MapPreview({ label }: MapPreviewProps) {
  const styles = useStyles();
  return (
    <View style={styles.tile} accessible accessibilityLabel={label}>
      <View style={[styles.line, styles.lineH]} />
      <View style={[styles.line, styles.lineV]} />
      <AppIcon name="map-marker" size="xl" color="primary" />
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  tile: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: spacing.lg,
  },
  line: {
    position: 'absolute',
    backgroundColor: colors.outline,
  },
  lineH: {
    left: 0,
    right: 0,
    top: '50%',
    height: layout.hairline,
  },
  lineV: {
    top: 0,
    bottom: 0,
    left: '50%',
    width: layout.hairline,
  },
}));
