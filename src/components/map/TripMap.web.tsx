/**
 * Web stand-in for the field-trip route map (Run 6): the stops plotted on
 * the same schematic "survey sheet" as DestinationMap.web.tsx, joined in
 * trip order by straight segments. Same props as TripMap.tsx.
 */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { LayoutRectangle } from 'react-native';

import { AppIcon } from '@/components/AppIcon';
import { AppText } from '@/components/AppText';
import { useI18n } from '@/context/I18nContext';
import { regionForCoordinates } from '@/lib/mapRegion';
import { layout, spacing } from '@/theme';
import { makeStyles, useAppTheme } from '@/theme/ThemeProvider';

import { TripPin } from './TripPin';
import type { TripMapProps } from './types';

const PIN_WIDTH = layout.tripPin + layout.pinShadowRoom * 2;
const PIN_HEIGHT = layout.tripPin + layout.pinPointer - layout.pinRimWidth + layout.pinShadowRoom * 2;

export function TripMap({ stops, start, label }: TripMapProps) {
  const styles = useStyles();
  const { colors } = useAppTheme();
  const { t } = useI18n();
  const [frame, setFrame] = useState<LayoutRectangle | null>(null);
  const points = [...(start ? [start] : []), ...stops];
  const region = regionForCoordinates(points);
  const pad = spacing.xl;

  const project = (latitude: number, longitude: number) => {
    const width = (frame?.width ?? 0) - pad * 2;
    const height = (frame?.height ?? 0) - pad * 2 - PIN_HEIGHT;
    const x = (longitude - (region.longitude - region.longitudeDelta / 2)) / region.longitudeDelta;
    const y = (region.latitude + region.latitudeDelta / 2 - latitude) / region.latitudeDelta;
    return { x: pad + x * width, y: pad + PIN_HEIGHT + y * height };
  };

  const projected = frame ? points.map((point) => project(point.latitude, point.longitude)) : [];

  return (
    <View style={styles.sheet} onLayout={(event) => setFrame(event.nativeEvent.layout)} accessible accessibilityLabel={label}>
      {projected.slice(1).map((to, index) => {
        const from = projected[index];
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        return (
          <View
            key={`seg-${index}`}
            style={{
              position: 'absolute',
              left: (from.x + to.x) / 2 - length / 2,
              top: (from.y + to.y) / 2 - layout.routeStroke / 2,
              width: length,
              height: layout.routeStroke,
              backgroundColor: colors.primary,
              transform: [{ rotate: `${Math.atan2(dy, dx)}rad` }],
            }}
          />
        );
      })}
      {projected.map((point, index) => {
        const isStart = Boolean(start) && index === 0;
        const number = start ? index : index + 1;
        return (
          <View key={`pin-${index}`} style={[styles.pin, { left: point.x - PIN_WIDTH / 2, top: point.y - PIN_HEIGHT }]}>
            <TripPin number={number} start={isStart} />
          </View>
        );
      })}
      <View style={styles.note} pointerEvents="none">
        <AppIcon name="information-outline" size="xs" color="muted" />
        <AppText variant="caption" color="muted">
          {t('map.webNote')}
        </AppText>
      </View>
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  sheet: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.surfaceMuted,
    overflow: 'hidden',
  },
  pin: {
    position: 'absolute',
    width: PIN_WIDTH,
    alignItems: 'center',
  },
  note: {
    position: 'absolute',
    left: spacing.md,
    bottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
}));
