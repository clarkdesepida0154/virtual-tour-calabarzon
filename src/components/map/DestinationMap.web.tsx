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
import { CATEGORY_META } from '@/constants/taxonomy';
import { regionForCoordinates } from '@/lib/mapRegion';
import { colors, elevation, layout, radius, spacing } from '@/theme';

import type { DestinationMapProps } from './types';

const PIN_SIZE = spacing.lg + spacing.xs;
const GRID_LINES = 6;

export function DestinationMap({ pins, selectedId, onSelect, onOpen, focus, insets }: DestinationMapProps) {
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
      left: spacing.xxl + x * usableWidth - PIN_SIZE / 2,
      top: usableTop + y * usableHeight - PIN_SIZE / 2,
    };
  };

  return (
    <Pressable
      style={styles.sheet}
      onPress={() => onSelect(null)}
      onLayout={(event) => setFrame(event.nativeEvent.layout)}
      accessibilityLabel="Schematic map of destinations in CALABARZON">
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
                  accessibilityLabel={`${pin.name}, ${pin.category}`}
                  hitSlop={spacing.sm}
                  style={[
                    styles.pin,
                    { backgroundColor: colors[CATEGORY_META[pin.category].color] },
                    isActive && styles.pinActive,
                  ]}
                />
                {isActive ? (
                  <Pressable
                    onPress={() => onOpen(pin.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${pin.name}`}
                    style={styles.callout}>
                    <AppText variant="label" numberOfLines={1}>
                      {pin.name}
                    </AppText>
                    <AppText variant="caption" color="inkSoft" numberOfLines={1}>
                      {pin.category}
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
          Web preview: schematic map. The phone app shows Google Maps.
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
    alignItems: 'flex-start',
  },
  pinWrapActive: {
    zIndex: 2,
  },
  pin: {
    width: PIN_SIZE,
    height: PIN_SIZE,
    borderRadius: radius.pill,
    borderWidth: 3,
    borderColor: colors.surface,
    ...elevation.card,
  },
  pinActive: {
    transform: [{ scale: 1.3 }],
  },
  callout: {
    marginTop: spacing.xs,
    marginLeft: -spacing.xl,
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
});
