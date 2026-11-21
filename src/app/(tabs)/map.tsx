import { useIsFocused, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppIcon } from '@/components/AppIcon';
import { AppIconButton } from '@/components/AppIconButton';
import { AppText } from '@/components/AppText';
import { CoverImage } from '@/components/CoverImage';
import { OfflineBanner } from '@/components/OfflineBanner';
import { EmptyState, ErrorState } from '@/components/StateViews';
import { CategoryLegend } from '@/components/map/CategoryLegend';
import { DestinationMap } from '@/components/map/DestinationMap';
import type { MapFocus } from '@/components/map/types';
import { ThemedStatusBar } from '@/components/ThemedStatusBar';
import { CATEGORY_META } from '@/constants/taxonomy';
import type { Category } from '@/constants/taxonomy';
import { useI18n } from '@/context/I18nContext';
import { useMapPins } from '@/hooks/useDestinations';
import { formatPlace } from '@/lib/format';
import { iconSize, layout, motion, radius, spacing } from '@/theme';
import { makeStyles, useAppTheme } from '@/theme/ThemeProvider';
import type { DestinationPin } from '@/types/database';

const CARD_HEIGHT = layout.listCardImageHeight - spacing.xxl;

export default function MapScreen() {
  const styles = useStyles();
  const { colors } = useAppTheme();
  const { t } = useI18n();
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
      {isFocused ? <ThemedStatusBar /> : null}

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
              {t('common.region')}
            </AppText>
            <AppText variant="screenTitle" accessibilityRole="header">
              {t('map.title')}
            </AppText>
          </View>
          {allPins.length > 0 ? (
            <AppIconButton
              icon="map-marker-path"
              mode="contained"
              size={iconSize.md}
              containerColor={colors.surface}
              iconColor={colors.primary}
              onPress={() => router.push('/planner')}
              accessibilityLabel={t('planner.openA11y')}
              style={styles.roundButton}
            />
          ) : null}
          {allPins.length > 0 ? (
            <AppIconButton
              icon="arrow-expand-all"
              mode="contained"
              size={iconSize.md}
              containerColor={colors.surface}
              iconColor={colors.ink}
              onPress={() => {
                setSelectedId(null);
                setFocus({ kind: 'all', nonce: Date.now() });
              }}
              accessibilityLabel={t('map.showRegion')}
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
        <View style={styles.centerState} accessibilityLabel={t('map.loadingA11y')}>
          <ActivityIndicator color={colors.primary} size="large" />
          <AppText variant="label" color="inkSoft">
            {t('map.loading')}
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
            title={t('map.empty.title')}
            message={t('map.empty.message')}
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
  const styles = useStyles();
  const { colors } = useAppTheme();
  const { t, categoryLabel } = useI18n();
  const meta = CATEGORY_META[pin.category];
  const category = categoryLabel(pin.category);
  return (
    <Animated.View
      key={pin.id}
      entering={FadeInDown.duration(motion.normal)}
      style={styles.cardWrap}
      pointerEvents="box-none">
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={`${t('map.pinA11y', { name: pin.name, category })}. ${t('map.viewDetails')}`}
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
        <CoverImage uri={pin.cover_image_url} label={t('common.photoOf', { name: pin.name })} style={styles.thumb} />
        <View style={styles.cardBody}>
          <View style={styles.cardCategory}>
            <View style={[styles.categoryChip, { backgroundColor: colors[meta.color] }]}>
              <AppIcon name={meta.icon} size="xs" color="pinRim" />
            </View>
            <AppText variant="overline" color="secondaryDark" numberOfLines={1} style={styles.flex}>
              {categoryLabel(pin.category, 'short')}
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
              {t('map.viewDetails')}
            </AppText>
            <AppIcon name="arrow-right" size="xs" color="primary" />
          </View>
        </View>
      </Pressable>
      <AppIconButton
        icon="close"
        size={iconSize.sm}
        mode="contained"
        containerColor={colors.surface}
        iconColor={colors.inkSoft}
        onPress={onClose}
        accessibilityLabel={t('map.closePreview')}
        style={styles.cardClose}
      />
    </Animated.View>
  );
}

const useStyles = makeStyles(({ colors, elevation }) => ({
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
    // A minimum, not a fixed height: large text sizes grow the card instead of clipping it.
    minHeight: CARD_HEIGHT,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: layout.hairline,
    borderColor: colors.outline,
    overflow: 'hidden',
    ...elevation.raised,
  },
  flex: {
    flex: 1,
  },
  pressed: {
    opacity: layout.pressedOpacity,
  },
  thumb: {
    width: CARD_HEIGHT,
    alignSelf: 'stretch',
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
  categoryChip: {
    width: layout.legendSwatch,
    height: layout.legendSwatch,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
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
}));
