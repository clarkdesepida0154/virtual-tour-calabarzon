import { useIsFocused, useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { IconButton } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppIcon } from '@/components/AppIcon';
import { AppText } from '@/components/AppText';
import { CoverImage } from '@/components/CoverImage';
import { OfflineBanner } from '@/components/OfflineBanner';
import { EmptyState, ErrorState } from '@/components/StateViews';
import { CategoryLegend } from '@/components/map/CategoryLegend';
import { DestinationMap } from '@/components/map/DestinationMap';
import type { MapFocus } from '@/components/map/types';
import { CATEGORY_META, REGION_LABEL } from '@/constants/taxonomy';
import type { Category } from '@/constants/taxonomy';
import { useMapPins } from '@/hooks/useDestinations';
import { formatPlace } from '@/lib/format';
import { colors, elevation, iconSize, layout, radius, spacing } from '@/theme';
import type { DestinationPin } from '@/types/database';

const CARD_HEIGHT = layout.listCardImageHeight - spacing.xxl;

export default function MapScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  // Details opens this tab with ?focus=<id>&at=<timestamp> to centre on one place.
  const params = useLocalSearchParams<{ focus?: string; at?: string }>();
  const pinsQuery = useMapPins();

  const [category, setCategory] = useState<Category | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focus, setFocus] = useState<MapFocus | null>(null);
  const [headerHeight, setHeaderHeight] = useState(0);

  const allPins = pinsQuery.data ?? [];
  const pins = category ? allPins.filter((pin) => pin.category === category) : allPins;
  const selected = pins.find((pin) => pin.id === selectedId) ?? null;

  const counts: Partial<Record<Category, number>> = {};
  for (const pin of allPins) counts[pin.category] = (counts[pin.category] ?? 0) + 1;

  // A request from Details: show every category, select the pin, fly to it.
  const focusParam = typeof params.focus === 'string' ? params.focus : null;
  const focusStamp = typeof params.at === 'string' ? params.at : null;
  const pinsLoaded = pinsQuery.data !== undefined;
  const requestKey = focusParam ? `${focusParam}@${focusStamp ?? ''}` : null;
  const [handledRequest, setHandledRequest] = useState<string | null>(null);
  // Adjusting state when a param changes (React's recommended render-time
  // pattern, instead of an effect): handle each request exactly once.
  if (requestKey && pinsLoaded && requestKey !== handledRequest) {
    setHandledRequest(requestKey);
    setCategory(null);
    setSelectedId(focusParam);
    setFocus({ kind: 'pin', id: focusParam!, nonce: Number(focusStamp) || 1 });
  }

  const open = (id: string) => router.push({ pathname: '/destination/[id]', params: { id } });

  const changeCategory = (next: Category | null) => {
    setCategory(next);
    setSelectedId(null);
    setFocus({ kind: 'all', nonce: Date.now() });
  };

  const select = (id: string | null) => setSelectedId(id);

  const cardSpace = selected ? CARD_HEIGHT + spacing.lg * 2 : spacing.lg;

  return (
    <View style={styles.screen}>
      {isFocused ? <StatusBar style="dark" /> : null}

      {pinsQuery.status === 'success' && allPins.length > 0 ? (
        <DestinationMap
          pins={pins}
          selectedId={selectedId}
          onSelect={select}
          onOpen={open}
          focus={focus}
          insets={{ top: headerHeight, bottom: cardSpace }}
        />
      ) : null}

      {/* Floating header: title + legend */}
      <View
        style={[styles.header, { paddingTop: insets.top + spacing.md }]}
        onLayout={(event: LayoutChangeEvent) => setHeaderHeight(event.nativeEvent.layout.height)}>
        <View style={styles.titleRow}>
          <View style={styles.titles}>
            <AppText variant="overline" color="secondaryDark">
              {REGION_LABEL}
            </AppText>
            <AppText variant="screenTitle" accessibilityRole="header">
              Map
            </AppText>
          </View>
          {allPins.length > 0 ? (
            <IconButton
              icon="arrow-expand-all"
              mode="contained"
              size={iconSize.md}
              containerColor={colors.surface}
              iconColor={colors.ink}
              onPress={() => {
                setSelectedId(null);
                setFocus({ kind: 'all', nonce: Date.now() });
              }}
              accessibilityLabel="Show the whole region"
              style={styles.roundButton}
            />
          ) : null}
        </View>
        {allPins.length > 0 ? (
          <CategoryLegend selected={category} onChange={changeCategory} counts={counts} />
        ) : null}
        <OfflineBanner style={styles.offline} />
      </View>

      {pinsQuery.status === 'loading' ? (
        <View style={styles.centerState} accessibilityLabel="Loading the map">
          <ActivityIndicator color={colors.primary} size="large" />
          <AppText variant="label" color="inkSoft">
            Plotting 5 provinces…
          </AppText>
        </View>
      ) : pinsQuery.status === 'error' && pinsQuery.error ? (
        <View style={styles.centerState}>
          <ErrorState error={pinsQuery.error} onRetry={pinsQuery.retry} />
        </View>
      ) : allPins.length === 0 ? (
        <View style={styles.centerState}>
          <EmptyState
            icon="map-marker-off-outline"
            title="Nothing to plot yet"
            message="None of the destinations has coordinates. Add a latitude and longitude when editing one."
          />
        </View>
      ) : null}

      {selected ? <SelectedCard pin={selected} onOpen={() => open(selected.id)} onClose={() => select(null)} /> : null}
    </View>
  );
}

function SelectedCard({
  pin,
  onOpen,
  onClose,
}: {
  pin: DestinationPin;
  onOpen: () => void;
  onClose: () => void;
}) {
  const meta = CATEGORY_META[pin.category];
  return (
    <View style={styles.cardWrap} pointerEvents="box-none">
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={`${pin.name}, ${pin.category}. Open details`}
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
        <CoverImage uri={pin.cover_image_url} label={`Photo of ${pin.name}`} style={styles.thumb} />
        <View style={styles.cardBody}>
          <View style={styles.cardCategory}>
            <View style={[styles.swatch, { backgroundColor: colors[meta.color] }]} />
            <AppText variant="overline" color="secondaryDark" numberOfLines={1}>
              {meta.shortLabel}
            </AppText>
          </View>
          <AppText variant="cardTitleSmall" numberOfLines={2}>
            {pin.name}
          </AppText>
          <AppText variant="caption" color="inkSoft" numberOfLines={1}>
            {formatPlace(pin)}
          </AppText>
          <View style={styles.cardLink}>
            <AppText variant="label" color="primary">
              View details
            </AppText>
            <AppIcon name="arrow-right" size="xs" color="primary" />
          </View>
        </View>
      </Pressable>
      <IconButton
        icon="close"
        size={iconSize.sm}
        mode="contained"
        containerColor={colors.surface}
        iconColor={colors.inkSoft}
        onPress={onClose}
        accessibilityLabel="Close the preview"
        style={styles.cardClose}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  offline: {
    marginHorizontal: spacing.lg,
  },
  screen: {
    flex: 1,
    backgroundColor: colors.surfaceMuted,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingBottom: spacing.md,
    gap: spacing.md,
    backgroundColor: colors.background,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
    ...elevation.raised,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  titles: {
    flex: 1,
    gap: spacing.xs,
  },
  roundButton: {
    ...elevation.card,
  },
  centerState: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingTop: layout.featuredCardHeight / 2,
  },
  cardWrap: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.lg,
    alignItems: 'center',
  },
  card: {
    flexDirection: 'row',
    width: '100%',
    maxWidth: layout.maxContentWidth,
    height: CARD_HEIGHT,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    ...elevation.raised,
  },
  pressed: {
    opacity: layout.pressedOpacity,
  },
  thumb: {
    width: CARD_HEIGHT,
    height: '100%',
  },
  cardBody: {
    flex: 1,
    padding: spacing.md,
    paddingRight: spacing.xxl,
    gap: spacing.xs,
    justifyContent: 'center',
  },
  cardCategory: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  swatch: {
    width: spacing.sm + 2,
    height: spacing.sm + 2,
    borderRadius: radius.pill,
  },
  cardLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  cardClose: {
    position: 'absolute',
    top: -spacing.md,
    right: -spacing.xs,
    ...elevation.card,
  },
});
