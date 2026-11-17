import { useRouter } from 'expo-router';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { DestinationCard } from '@/components/DestinationCard';
import { FilterChipRow } from '@/components/FilterChips';
import type { FilterOption } from '@/components/FilterChips';
import { LinearProgress } from '@/components/LinearProgress';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SearchField } from '@/components/SearchField';
import { DestinationCardSkeleton } from '@/components/Skeleton';
import { EmptyState, ErrorState } from '@/components/StateViews';
import { CATEGORIES, CATEGORY_META, PROVINCES, REGION_LABEL } from '@/constants/taxonomy';
import type { Category, Province } from '@/constants/taxonomy';
import { useExploreFilters } from '@/context/ExploreFiltersContext';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useDestinations } from '@/hooks/useDestinations';
import { pluralize } from '@/lib/format';
import { colors, layout, motion, spacing } from '@/theme';
import type { Destination } from '@/types/database';

const CATEGORY_OPTIONS: FilterOption<Category>[] = CATEGORIES.map((category) => ({
  value: category,
  label: CATEGORY_META[category].shortLabel,
  icon: CATEGORY_META[category].icon,
}));

const PROVINCE_OPTIONS: FilterOption<Province>[] = PROVINCES.map((province) => ({
  value: province,
  label: province,
}));

const SKELETON_COUNT = 3;

export default function ExploreScreen() {
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

  const destinations = list.data ?? [];
  const isUpdating = list.status === 'success' && (list.isFetching || filters.query !== debouncedQuery);

  const openDestination = (destination: Destination) =>
    router.push({ pathname: '/destination/[id]', params: { id: destination.id } });

  return (
    <View style={styles.screen}>
      <ScreenHeader overline={REGION_LABEL} title="Explore" />

      <View style={styles.controls}>
        <SearchField
          value={filters.query}
          onChangeText={setQuery}
          placeholder="Search by name or town"
          style={styles.search}
        />
        <FilterChipRow
          title="Category"
          options={CATEGORY_OPTIONS}
          selected={filters.category}
          onToggle={toggleCategory}
        />
        <FilterChipRow
          title="Province"
          options={PROVINCE_OPTIONS}
          selected={filters.province}
          onToggle={toggleProvince}
        />
      </View>

      <LinearProgress visible={isUpdating} accessibilityLabel="Updating results" />

      {list.status === 'loading' ? (
        <View style={styles.list} accessibilityLabel="Loading destinations">
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
          renderItem={({ item }) => <DestinationCard destination={item} onPress={openDestination} />}
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
            destinations.length > 0 ? (
              <View style={styles.summary}>
                <AppText variant="label" color="inkSoft" style={styles.summaryText}>
                  {activeCount > 0
                    ? `${pluralize(destinations.length, 'match', 'matches')} for your filters`
                    : pluralize(destinations.length, 'destination')}
                </AppText>
                {activeCount > 0 ? <ClearFiltersButton onPress={clearFilters} /> : null}
              </View>
            ) : undefined
          }
          ListEmptyComponent={
            activeCount > 0 ? (
              <EmptyState
                icon="map-search-outline"
                title="No matches"
                message="No destination fits that search and those filters. Try a different word, or widen the filters."
                actionLabel="Clear filters"
                actionIcon="filter-remove-outline"
                onAction={clearFilters}
                style={styles.state}
              />
            ) : (
              <EmptyState
                icon="map-search-outline"
                title="No destinations yet"
                message="The collection is empty. Add the first place worth visiting in CALABARZON."
                actionLabel="Add a destination"
                actionIcon="plus"
                onAction={() => router.navigate('/add')}
                style={styles.state}
              />
            )
          }
        />
      )}
    </View>
  );
}

function ClearFiltersButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={spacing.md}
      accessibilityRole="button"
      accessibilityLabel="Clear all filters"
      style={({ pressed }) => pressed && styles.pressed}>
      <AppText variant="label" color="primary">
        Clear filters
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
    paddingBottom: layout.snackbarOffset,
    gap: spacing.lg,
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
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
});
