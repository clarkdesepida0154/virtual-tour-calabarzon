/**
 * Web stand-in for the native map. react-native-maps has no web support, so
 * the browser build plots the pins on a simple projected "survey sheet" of
 * CALABARZON. Same props as DestinationMap.tsx; the phone gets Google Maps.
 */
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { LayoutRectangle } from 'react-native';

import { AppIcon } from '@/components/AppIcon';
import { AppText } from '@/components/AppText';
import { useI18n } from '@/context/I18nContext';
import { regionForCoordinates } from '@/lib/mapRegion';
import { layout, radius, spacing } from '@/theme';
import { makeStyles } from '@/theme/ThemeProvider';

import { MapPin } from './MapPin';
import type { DestinationMapProps } from './types';

/** Size of an (unselected) MapPin, so its pointer tip sits on the coordinate. */
const PIN_WIDTH = layout.pinHead + layout.pinShadowRoom * 2;
const PIN_HEIGHT = layout.pinHead + layout.pinPointer - layout.pinRimWidth + layout.pinShadowRoom * 2;
const GRID_LINES = 6;

export function DestinationMap({ pins, selectedId, onSelect, onOpen, focus, insets }: DestinationMapProps) {
  const styles = useStyles();
  const { t, categoryLabel } = useI18n();
  const [frame, setFrame] = useState<LayoutRectangle | null>(null);
  const region = regionForCoordinates(pins);
  const focusedId = focus?.kind === 'pin' ? focus.id : null;
  const activeId = selectedId ?? focusedId;

  const usableTop = insets.top + spacing.xl;
  const usableHeight = frame ? frame.height - usableTop - insets.bottom - spacing.xl : 0;
  const usableWidth = frame ? frame.width - spacing.xxl * 2 : 0;

  const position = (latitude: number, longitude: number) => {
    const x = (longitude - (region.longitude - region.longitudeDelta / 2)) / region.longitudeDelta;
    const y = ((region.latitude + region.latitudeDelta / 2) - latitude) / region.latitudeDelta;
    return {
      left: spacing.xxl + x * usableWidth - PIN_WIDTH / 2,
      top: usableTop + y * usableHeight - PIN_HEIGHT,
    };
  };

  return (
    <Pressable
      style={styles.sheet}
      onPress={() => onSelect(null)}
      onLayout={(event) => setFrame(event.nativeEvent.layout)}
      accessibilityLabel={t('map.schematicA11y')}>
      {Array.from({ length: GRID_LINES }, (_, line) => (
        <View
          key={`h${line}`}
          style={[styles.gridH, { top: `${((line + 1) * 100) / (GRID_LINES + 1)}%` }]}
        />
      ))}
      {Array.from({ length: GRID_LINES }, (_, line) => (
        <View
          key={`v${line}`}
          style={[styles.gridV, { left: `${((line + 1) * 100) / (GRID_LINES + 1)}%` }]}
        />
      ))}

      {frame
        ? pins.map((pin) => {
            const isActive = pin.id === activeId;
            const point = position(pin.latitude, pin.longitude);
            return (
              <View key={pin.id} style={[styles.pinWrap, point, isActive && styles.pinWrapActive]}>
                <Pressable
                  onPress={() => onSelect(pin.id)}
                  accessibilityRole="button"
                  accessibilityLabel={t('map.pinA11y', { name: pin.name, category: categoryLabel(pin.category) })}
                  hitSlop={spacing.xs}
                  style={styles.pin}>
                  <MapPin category={pin.category} selected={isActive} />
                </Pressable>
                {isActive ? (
                  <Pressable
                    onPress={() => onOpen(pin.id)}
                    accessibilityRole="button"
                    accessibilityLabel={t('map.openPin', { name: pin.name })}
                    style={styles.callout}>
                    <AppText variant="label" numberOfLines={1}>
                      {pin.name}
                    </AppText>
                    <AppText variant="caption" color="inkSoft" numberOfLines={1}>
                      {categoryLabel(pin.category)}
                    </AppText>
                  </Pressable>
                ) : null}
              </View>
            );
          })
        : null}

      <View style={[styles.note, { bottom: insets.bottom + spacing.sm }]} pointerEvents="none">
        <AppIcon name="information-outline" size="xs" color="muted" />
        <AppText variant="caption" color="muted">
          {t('map.webNote')}
        </AppText>
      </View>
    </Pressable>
  );
}

const useStyles = makeStyles(({ colors, elevation }) => ({
  sheet: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.surfaceMuted,
    overflow: 'hidden',
  },
  gridH: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: layout.hairline,
    backgroundColor: colors.outline,
  },
  gridV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: layout.hairline,
    backgroundColor: colors.outline,
  },
  pinWrap: {
    position: 'absolute',
    alignItems: 'center',
    width: PIN_WIDTH,
  },
  pinWrapActive: {
    zIndex: 2,
  },
  pin: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: PIN_HEIGHT,
  },
  callout: {
    marginTop: spacing.xs,
    maxWidth: layout.featuredCardWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    ...elevation.raised,
  },
  note: {
    position: 'absolute',
    left: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
}));
