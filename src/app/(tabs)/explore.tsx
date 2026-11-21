import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { FAB } from 'react-native-paper';

import { AppText } from '@/components/AppText';
import { DestinationCard } from '@/components/DestinationCard';
import { FilterChip, FilterChipRow } from '@/components/FilterChips';
import type { FilterOption } from '@/components/FilterChips';
import { LinearProgress } from '@/components/LinearProgress';
import { NearMePrompt } from '@/components/NearMePrompt';
import { OfflineBanner } from '@/components/OfflineBanner';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SearchField } from '@/components/SearchField';
import { DestinationCardSkeleton } from '@/components/Skeleton';
import { EmptyState, ErrorState } from '@/components/StateViews';
import { CATEGORIES, CATEGORY_META, PROVINCES } from '@/constants/taxonomy';
import type { Category, Province } from '@/constants/taxonomy';
import { useExploreFilters } from '@/context/ExploreFiltersContext';
import { useUserLocation } from '@/context/LocationContext';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useDestinations } from '@/hooks/useDestinations';
import { distanceFrom, sortByDistance } from '@/lib/geo';
import { layout, motion, radius, spacing } from '@/theme';
import { makeStyles, useAppTheme } from '@/theme/ThemeProvider';
import type { DestinationSummary } from '@/types/database';
import { useI18n } from '@/context/I18nContext';

const PROVINCE_OPTIONS: FilterOption<Province>[] = PROVINCES.map((province) => ({
  value: province,
  label: province,
}));

const SKELETON_COUNT = 3;

export default function ExploreScreen() {
  const styles = useStyles();
  const { t, categoryLabel, distance } = useI18n();
  const categoryOptions: FilterOption<Category>[] = CATEGORIES.map((category) => ({
    value: category,
    label: categoryLabel(category, 'short'),
    icon: CATEGORY_META[category].icon,
  }));
  const { colors } = useAppTheme();
  const router = useRouter();
  const { filters, activeCount, setQuery, toggleCategory, toggleProvince, clearFilters } =
    useExploreFilters();

  // Search-as-you-type: wait for a pause in typing before asking the server.
  const debouncedQuery = useDebouncedValue(filters.query, motion.searchDebounce);
  const list = useDestinations({
    search: debouncedQuery,
    category: filters.category,
    province: filters.province,
  });

  // Near me: distances on every card, and an optional "Nearest first" order.
  const location = useUserLocation();
  const [nearestFirst, setNearestFirst] = useState(false);
  const origin = location.isAvailable ? location.position : null;
  const sortNearest = nearestFirst && origin !== null;

  const destinations = useMemo(() => {
    const rows = list.data ?? [];
    return sortNearest && origin ? sortByDistance(rows, origin) : rows;
  }, [list.data, sortNearest, origin]);
  const isUpdating = list.status === 'success' && (list.isFetching || filters.query !== debouncedQuery);

  const toggleNearest = async () => {
    if (nearestFirst) {
      setNearestFirst(false);
      return;
    }
    // Asking for "Nearest first" is a clear reason to ask for location.
    if (location.status === 'undetermined' && !(await location.requestPermission())) return;
    setNearestFirst(true);
  };

  const openDestination = (destination: DestinationSummary) =>
    router.push({ pathname: '/destination/[id]', params: { id: destination.id } });

  return (
    <View style={styles.screen}>
      <ScreenHeader overline={t('common.region')} title={t('explore.title')} />

      <View style={styles.controls}>
        <SearchField
          value={filters.query}
          onChangeText={setQuery}
          placeholder={t('explore.searchPlaceholder')}
          style={styles.search}
        />
        <FilterChipRow
          title={t('explore.category')}
          options={categoryOptions}
          selected={filters.category}
          onToggle={toggleCategory}
        />
        <FilterChipRow
          title={t('explore.province')}
          options={PROVINCE_OPTIONS}
          selected={filters.province}
          onToggle={toggleProvince}
        />
      </View>

      <LinearProgress visible={isUpdating} accessibilityLabel={t('explore.updatingA11y')} />

      {list.status === 'loading' ? (
        <View style={styles.list} accessibilityLabel={t('explore.loadingA11y')}>
          {Array.from({ length: SKELETON_COUNT }, (_, index) => (
            <DestinationCardSkeleton key={index} />
          ))}
        </View>
      ) : list.status === 'error' && list.error ? (
        <ErrorState error={list.error} onRetry={list.retry} style={styles.state} />
      ) : (
        <FlatList
          data={destinations}
          keyExtractor={(destination) => destination.id}
          renderItem={({ item }) => {
            const km = distanceFrom(origin, item);
            return (
              <DestinationCard
                destination={item}
                onPress={openDestination}
                distance={km === null ? null : distance(km)}
              />
            );
          }}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={list.isRefreshing}
              onRefresh={list.refresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
              progressBackgroundColor={colors.surface}
            />
          }
          ListHeaderComponent={
            <View style={styles.header}>
              <OfflineBanner />
              <NearMePrompt />
              {destinations.length > 0 ? (
                <View style={styles.summary}>
                  <AppText variant="label" color="inkSoft" style={styles.summaryText}>
                    {activeCount > 0
                      ? t('explore.matches', { count: destinations.length })
                      : t('explore.count', { count: destinations.length })}
                  </AppText>
                  {activeCount > 0 ? <ClearFiltersButton onPress={clearFilters} /> : null}
                  {location.isOffered ? (
                    <FilterChip
                      label={t('explore.nearestFirst')}
                      icon="crosshairs-gps"
                      selected={sortNearest}
                      onPress={() => void toggleNearest()}
                    />
                  ) : null}
                </View>
              ) : null}
            </View>
          }
          ListEmptyComponent={
            activeCount > 0 ? (
              <EmptyState
                icon="map-search-outline"
                title={t('explore.noMatches.title')}
                message={t('explore.noMatches.message')}
                actionLabel={t('explore.clearFilters')}
                actionIcon="filter-remove-outline"
                onAction={clearFilters}
                style={styles.state}
              />
            ) : (
              <EmptyState
                icon="map-search-outline"
                title={t('home.empty.title')}
                message={t('home.empty.message')}
                actionLabel={t('home.empty.action')}
                actionIcon="plus"
                onAction={() => router.push('/add')}
                style={styles.state}
              />
            )
          }
        />
      )}

      <FAB
        icon="plus"
        label={t('explore.add')}
        onPress={() => router.push('/add')}
        color={colors.onPrimary}
        style={styles.fab}
        accessibilityLabel={t('explore.addA11y')}
        accessibilityHint={t('explore.addHint')}
      />
    </View>
  );
}

function ClearFiltersButton({ onPress }: { onPress: () => void }) {
  const styles = useStyles();
  const { t } = useI18n();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={spacing.md}
      accessibilityRole="button"
      accessibilityLabel={t('explore.clearFiltersA11y')}
      style={({ pressed }) => pressed && styles.pressed}>
      <AppText variant="label" color="primary">
        {t('explore.clearFilters')}
      </AppText>
    </Pressable>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  controls: {
    gap: spacing.md,
    paddingBottom: spacing.md,
  },
  search: {
    marginHorizontal: spacing.xl,
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: layout.fabClearance,
    gap: spacing.lg,
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
  },
  header: {
    gap: spacing.md,
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  summaryText: {
    flex: 1,
  },
  state: {
    marginTop: spacing.xl,
  },
  pressed: {
    opacity: layout.pressedOpacity,
  },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
  },
}));
