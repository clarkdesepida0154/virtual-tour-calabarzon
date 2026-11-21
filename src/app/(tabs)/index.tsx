import { useIsFocused, useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppIcon } from '@/components/AppIcon';
import { AppIconButton } from '@/components/AppIconButton';
import { AppText } from '@/components/AppText';
import { FeaturedCard } from '@/components/DestinationCard';
import { OfflineBanner } from '@/components/OfflineBanner';
import { SearchField } from '@/components/SearchField';
import { SectionHeader } from '@/components/SectionHeader';
import { FeaturedCardSkeleton } from '@/components/Skeleton';
import { EmptyState, ErrorState } from '@/components/StateViews';
import { ThemedStatusBar } from '@/components/ThemedStatusBar';
import {
  CATEGORIES,
  CATEGORY_META,
  PROVINCES,
} from '@/constants/taxonomy';
import type { Category, Province } from '@/constants/taxonomy';
import { useExploreFilters } from '@/context/ExploreFiltersContext';
import type { ExploreFilters } from '@/context/ExploreFiltersContext';
import { useHomeData } from '@/hooks/useDestinations';
import { layout, radius, spacing, iconSize } from '@/theme';
import { makeStyles, useAppTheme } from '@/theme/ThemeProvider';
import type { DestinationSummary } from '@/types/database';
import { useI18n } from '@/context/I18nContext';

export default function HomeScreen() {
  const styles = useStyles();
  const { colors } = useAppTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const isFocused = useIsFocused();
  const { applyFilters } = useExploreFilters();
  const home = useHomeData();
  const [query, setQuery] = useState('');

  const featured = home.data?.featured ?? [];
  const counts = home.data?.counts;

  /** Pre-fills the Explore filters, then switches to that tab. */
  const openExplore = (filters: Partial<ExploreFilters> = {}) => {
    applyFilters(filters);
    router.navigate('/explore');
  };

  const submitSearch = () => {
    openExplore({ query: query.trim() });
    setQuery('');
  };

  const openDestination = (destination: DestinationSummary) =>
    router.push({ pathname: '/destination/[id]', params: { id: destination.id } });

  return (
    <View style={styles.screen}>
      {isFocused ? <ThemedStatusBar overDark /> : null}

      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={home.isRefreshing}
            onRefresh={home.refresh}
            colors={[colors.primary]}
            tintColor={colors.onPhoto}
            progressBackgroundColor={colors.surface}
            progressViewOffset={insets.top}
          />
        }>
        {/* Hero: app name and tagline */}
        <View style={[styles.hero, { paddingTop: insets.top + spacing.xl }]}>
          <View style={styles.watermark} pointerEvents="none">
            <AppIcon name="compass-rose" size="watermark" color="heroWatermark" />
          </View>
          <View style={styles.heroTop}>
            <AppText variant="overline" color="heroAccent" style={styles.flex}>
              {t('common.region')}
            </AppText>
            <AppIconButton
              icon="cog-outline"
              mode="contained"
              size={iconSize.md}
              containerColor={colors.glass}
              iconColor={colors.onPhoto}
              onPress={() => router.push('/settings')}
              accessibilityLabel={t('settings.openA11y')}
              style={styles.gear}
            />
          </View>
          <AppText variant="hero" color="onPhoto" accessibilityRole="header">
            {t('home.heroTitle')}
          </AppText>
          <View style={styles.heroRule} />
          <AppText variant="tagline" color="onPhotoMuted">
            {t('home.tagline')}
          </AppText>
        </View>

        <View style={styles.search}>
          <SearchField
            tone="raised"
            value={query}
            onChangeText={setQuery}
            onSubmit={submitSearch}
            placeholder={t('home.searchPlaceholder')}
          />
        </View>

        <OfflineBanner style={styles.offline} />

        {/* Featured carousel */}
        <View style={styles.section}>
          <SectionHeader
            title={t('home.featured.title')}
            subtitle={t('home.featured.subtitle')}
            actionLabel={t('common.seeAll')}
            onAction={() => openExplore()}
          />
          {home.status === 'loading' ? (
            <View style={styles.carousel} accessibilityLabel={t('home.featured.loadingA11y')}>
              <FeaturedCardSkeleton />
              <FeaturedCardSkeleton />
            </View>
          ) : home.status === 'error' && home.error ? (
            <ErrorState error={home.error} onRetry={home.retry} />
          ) : featured.length === 0 ? (
            <EmptyState
              icon="map-search-outline"
              title={t('home.empty.title')}
              message={t('home.empty.message')}
              actionLabel={t('home.empty.action')}
              actionIcon="plus"
              onAction={() => router.push('/add')}
            />
          ) : (
            <FlatList
              horizontal
              data={featured}
              keyExtractor={(destination) => destination.id}
              renderItem={({ item }) => <FeaturedCard destination={item} onPress={openDestination} />}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.carousel}
              snapToInterval={layout.featuredCardWidth + spacing.lg}
              decelerationRate="fast"
            />
          )}
        </View>

        {/* Category grid */}
        <View style={styles.section}>
          <SectionHeader
            title={t('home.categories.title')}
            subtitle={t('home.categories.subtitle')}
          />
          <View style={styles.grid}>
            {CATEGORIES.map((category, index) => (
              <CategoryTile
                key={category}
                category={category}
                count={counts?.byCategory[category]}
                // An odd one out at the end spans the full row.
                wide={CATEGORIES.length % 2 === 1 && index === CATEGORIES.length - 1}
                onPress={() => openExplore({ category })}
              />
            ))}
          </View>
        </View>

        {/* Province shortcuts */}
        <View style={styles.section}>
          <SectionHeader
            title={t('home.provinces.title')}
            subtitle={t('home.provinces.subtitle')}
          />
          <View style={styles.directory}>
            {PROVINCES.map((province, index) => (
              <ProvinceRow
                key={province}
                province={province}
                count={counts?.byProvince[province]}
                showDivider={index > 0}
                onPress={() => openExplore({ province })}
              />
            ))}
          </View>
        </View>

        <View style={styles.footer}>
          <AppIcon name="compass-rose" size="md" color="secondary" />
          <AppText variant="caption" color="muted" align="center">
            An alternative to educational field trips.{'\n'}
            {PROVINCES.join(' · ')}
          </AppText>
        </View>
      </ScrollView>

      {/* Keeps the status bar readable once the hero scrolls away. */}
      <View style={[styles.statusBarBacking, { height: insets.top }]} pointerEvents="none" />
    </View>
  );
}

type CategoryTileProps = {
  category: Category;
  count: number | undefined;
  wide: boolean;
  onPress: () => void;
};

function CategoryTile({ category, count, wide, onPress }: CategoryTileProps) {
  const styles = useStyles();
  const { colors } = useAppTheme();
  const { t, categoryLabel } = useI18n();
  const meta = CATEGORY_META[category];
  const label = categoryLabel(category);
  const countLabel = count === undefined ? categoryLabel(category, 'blurb') : t('home.categories.count', { count });

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${countLabel}`}
      accessibilityHint={t('home.categories.hint')}
      android_ripple={{ color: colors.pressed }}
      style={({ pressed }) => [styles.tile, wide && styles.tileWide, pressed && styles.pressed]}>
      <View style={styles.tileIcon}>
        <AppIcon name={meta.icon} size="md" color="secondaryDark" />
      </View>
      <View style={wide ? styles.flex : undefined}>
        <AppText variant="subtitle" numberOfLines={2}>
          {label}
        </AppText>
        <AppText variant="caption" color="inkSoft" numberOfLines={1}>
          {countLabel}
        </AppText>
      </View>
    </Pressable>
  );
}

type ProvinceRowProps = {
  province: Province;
  count: number | undefined;
  showDivider: boolean;
  onPress: () => void;
};

function ProvinceRow({ province, count, showDivider, onPress }: ProvinceRowProps) {
  const styles = useStyles();
  const { colors } = useAppTheme();
  const { t, provinceTagline } = useI18n();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        count === undefined ? province : `${province}, ${t('explore.count', { count })}`
      }
      accessibilityHint={t('home.provinces.hint')}
      android_ripple={{ color: colors.pressed }}
      style={({ pressed }) => [
        styles.directoryRow,
        showDivider && styles.directoryDivider,
        pressed && styles.pressed,
      ]}>
      <View style={styles.monogram}>
        <AppText variant="monogram" color="primary">
          {province.charAt(0)}
        </AppText>
      </View>
      <View style={styles.flex}>
        <AppText variant="subtitle">{province}</AppText>
        <AppText variant="caption" color="inkSoft" numberOfLines={2}>
          {provinceTagline(province)}
        </AppText>
      </View>
      {count === undefined ? null : (
        <View style={styles.countPill}>
          <AppText variant="label" color="secondaryDark">
            {count}
          </AppText>
        </View>
      )}
      <AppIcon name="chevron-right" size="md" color="muted" />
    </Pressable>
  );
}

const useStyles = makeStyles(({ colors, elevation }) => ({
  offline: {
    marginHorizontal: spacing.xl,
    marginTop: spacing.lg,
  },
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  content: {
    paddingBottom: spacing.xxl,
  },
  statusBarBacking: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.heroBackground,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  gear: {
    margin: 0,
  },
  hero: {
    backgroundColor: colors.heroBackground,
    paddingHorizontal: spacing.xl,
    paddingBottom: layout.searchBarHeight / 2 + spacing.xl,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
    gap: spacing.sm,
    overflow: 'hidden',
  },
  watermark: {
    position: 'absolute',
    right: -spacing.xxl,
    bottom: -spacing.xl,
  },
  heroRule: {
    width: layout.ornamentWidth,
    height: layout.ornamentHeight,
    borderRadius: radius.pill,
    backgroundColor: colors.secondary,
    marginVertical: spacing.xs,
  },
  search: {
    marginTop: -layout.searchBarHeight / 2,
    paddingHorizontal: spacing.xl,
  },
  section: {
    marginTop: spacing.xxl,
    gap: spacing.lg,
  },
  carousel: {
    flexDirection: 'row',
    gap: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xs,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  tile: {
    flexBasis: '47%',
    flexGrow: 1,
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    ...elevation.card,
  },
  tileWide: {
    flexBasis: '100%',
    flexDirection: 'row',
    alignItems: 'center',
  },
  tileIcon: {
    width: layout.iconBadge,
    height: layout.iconBadge,
    borderRadius: radius.pill,
    backgroundColor: colors.secondarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  directory: {
    marginHorizontal: spacing.xl,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    ...elevation.card,
  },
  directoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: layout.touchTarget + spacing.xl,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  directoryDivider: {
    borderTopWidth: layout.hairline,
    borderTopColor: colors.outline,
  },
  monogram: {
    width: layout.iconBadge,
    height: layout.iconBadge,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countPill: {
    minWidth: spacing.xxl,
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.secondarySoft,
  },
  pressed: {
    opacity: layout.pressedOpacity,
  },
  footer: {
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xxl,
    paddingHorizontal: spacing.xl,
  },
}));
