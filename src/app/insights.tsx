/**
 * Heritage Insights (Run 6) — community statistics, computed on the phone
 * from every visit, quiz attempt and rating: most visited, top rated,
 * toughest quizzes, visits by province and by category. Rendered with the
 * app's own rows and bars (no chart library). Pull to refresh; works from
 * the saved copy offline; friendly empty states on a fresh database.
 */
import { useRouter } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { AppIcon } from '@/components/AppIcon';
import type { IconName } from '@/components/AppIcon';
import { AppText } from '@/components/AppText';
import { Meter } from '@/components/Badges';
import { OfflineBanner } from '@/components/OfflineBanner';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SectionHeader } from '@/components/SectionHeader';
import { Skeleton } from '@/components/Skeleton';
import { EmptyState, ErrorState } from '@/components/StateViews';
import { ThemedStatusBar } from '@/components/ThemedStatusBar';
import { useI18n } from '@/context/I18nContext';
import { useInsights } from '@/hooks/useInsights';
import { formatPlace } from '@/lib/format';
import { barShare } from '@/lib/insights';
import type { RankedDestination } from '@/lib/insights';
import { formatAverage } from '@/lib/ratings';
import { layout, radius, spacing } from '@/theme';
import { makeStyles, useAppTheme } from '@/theme/ThemeProvider';
import type { DestinationSummary } from '@/types/database';

export default function InsightsScreen() {
  const styles = useStyles();
  const { colors } = useAppTheme();
  const { t, categoryLabel } = useI18n();
  const router = useRouter();
  const query = useInsights();
  const insights = query.data;

  const leave = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/progress');
  };
  const open = (id: string) => router.push({ pathname: '/destination/[id]', params: { id } });

  return (
    <View style={styles.screen}>
      <ThemedStatusBar />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={query.isRefreshing}
            onRefresh={query.refresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
            progressBackgroundColor={colors.surface}
          />
        }>
        <ScreenHeader overline={t('insights.overline')} title={t('insights.title')} subtitle={t('insights.subtitle')} onBack={leave} />
        <View style={styles.body}>
          <OfflineBanner />
          {query.status === 'error' && query.error ? (
            <ErrorState error={query.error} onRetry={query.retry} />
          ) : !insights ? (
            <View style={styles.loading} accessible accessibilityLabel={t('insights.loadingA11y')}>
              <Skeleton height={layout.iconBadge * 2} style={styles.skeleton} />
              <Skeleton height={layout.progressRingSize * 1.5} style={styles.skeleton} />
              <Skeleton height={layout.progressRingSize} style={styles.skeleton} />
            </View>
          ) : (
            <>
              <View style={styles.totals}>
                <Total icon="map-marker-check-outline" label={t('insights.totalVisits')} value={insights.totals.visits} />
                <Total icon="clipboard-check-outline" label={t('insights.totalAttempts')} value={insights.totals.attempts} />
                <Total icon="star-outline" label={t('insights.totalRatings')} value={insights.totals.ratings} />
              </View>

              {insights.isEmpty ? (
                <View style={styles.card}>
                  <EmptyState icon="chart-box-outline" title={t('insights.emptyTitle')} message={t('insights.emptyMessage')} />
                </View>
              ) : null}

              <SectionHeader inset={false} title={t('insights.mostVisited.title')} subtitle={t('insights.mostVisited.subtitle')} />
              <RankedList
                rows={insights.mostVisited}
                onOpen={open}
                valueText={(row) => t('insights.visits', { count: row.value })}
                valueA11y={(row) => t('insights.visits', { count: row.value })}
                share={(row) => barShare(row.value, insights.mostVisited[0]?.value ?? 0)}
                color="success"
              />

              <SectionHeader inset={false} title={t('insights.topRated.title')} subtitle={t('insights.topRated.subtitle')} />
              <RankedList
                rows={insights.topRated}
                onOpen={open}
                valueText={(row) => t('insights.rated', { average: formatAverage(row.value), count: row.count })}
                valueA11y={(row) => t('insights.ratedA11y', { average: formatAverage(row.value), count: row.count })}
                share={(row) => barShare(row.value, 5)}
                color="secondary"
              />

              <SectionHeader inset={false} title={t('insights.toughest.title')} subtitle={t('insights.toughest.subtitle')} />
              <RankedList
                rows={insights.toughestQuizzes}
                onOpen={open}
                valueText={(row) => t('insights.scored', { percent: Math.round(row.value) })}
                valueA11y={(row) => t('insights.scoredA11y', { percent: Math.round(row.value), count: row.count })}
                share={(row) => barShare(row.value, 100)}
                color="primary"
              />

              <SectionHeader inset={false} title={t('insights.byProvince.title')} subtitle={t('insights.byProvince.subtitle')} />
              <BarCard
                rows={insights.visitsByProvince.map((row) => ({ key: row.province, label: row.province, value: row.visits }))}
              />

              <SectionHeader inset={false} title={t('insights.byCategory.title')} subtitle={t('insights.byCategory.subtitle')} />
              <BarCard
                rows={insights.visitsByCategory.map((row) => ({ key: row.category, label: categoryLabel(row.category), value: row.visits }))}
              />
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function Total({ icon, label, value }: { icon: IconName; label: string; value: number }) {
  const styles = useStyles();
  const { t } = useI18n();
  return (
    <View style={styles.total} accessible accessibilityLabel={t('insights.barA11y', { label, value: String(value) })}>
      <AppIcon name={icon} size="sm" color="secondaryDark" />
      <AppText variant="stat">{value}</AppText>
      <AppText variant="caption" color="inkSoft" align="center">
        {label}
      </AppText>
    </View>
  );
}

type Ranked = RankedDestination<DestinationSummary>;

function RankedList({
  rows,
  onOpen,
  valueText,
  valueA11y,
  share,
  color,
}: {
  rows: Ranked[];
  onOpen: (id: string) => void;
  valueText: (row: Ranked) => string;
  valueA11y: (row: Ranked) => string;
  share: (row: Ranked) => number;
  color: 'success' | 'secondary' | 'primary';
}) {
  const styles = useStyles();
  const { t } = useI18n();
  if (rows.length === 0) {
    return (
      <View style={styles.card}>
        <AppText variant="body" color="inkSoft">
          {t('insights.sectionEmpty')}
        </AppText>
      </View>
    );
  }
  return (
    <View style={styles.card}>
      {rows.map((row, index) => (
        <Pressable
          key={row.destination.id}
          onPress={() => onOpen(row.destination.id)}
          accessibilityRole="button"
          accessibilityLabel={t('insights.rowA11y', { rank: index + 1, name: row.destination.name, value: valueA11y(row) })}
          accessibilityHint={t('common.opensDetails')}
          style={({ pressed }) => [styles.rankRow, index > 0 && styles.divider, pressed && styles.pressed]}>
          <View style={styles.rank}>
            <AppText variant="label" color="secondaryDark">
              {index + 1}
            </AppText>
          </View>
          <View style={styles.rankBody}>
            <View style={styles.rankHead}>
              <AppText variant="subtitle" numberOfLines={2} style={styles.flex}>
                {row.destination.name}
              </AppText>
              <AppText variant="label" color="inkSoft">
                {valueText(row)}
              </AppText>
            </View>
            <AppText variant="caption" color="muted" numberOfLines={1}>
              {formatPlace(row.destination)}
            </AppText>
            <Meter value={share(row)} color={color} accessibilityLabel={valueA11y(row)} />
          </View>
        </Pressable>
      ))}
    </View>
  );
}

function BarCard({ rows }: { rows: { key: string; label: string; value: number }[] }) {
  const styles = useStyles();
  const { t } = useI18n();
  const max = Math.max(0, ...rows.map((row) => row.value));
  return (
    <View style={styles.card}>
      {rows.map((row, index) => {
        const value = t('insights.visits', { count: row.value });
        return (
          <View key={row.key} style={[styles.barRow, index > 0 && styles.divider]}>
            <View style={styles.rankHead}>
              <AppText variant="subtitle" style={styles.flex}>
                {row.label}
              </AppText>
              <AppText variant="label" color="inkSoft">
                {value}
              </AppText>
            </View>
            <Meter value={barShare(row.value, max)} color="secondary" accessibilityLabel={t('insights.barA11y', { label: row.label, value })} />
          </View>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles(({ colors, elevation }) => ({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    paddingBottom: layout.snackbarOffset,
  },
  body: {
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
  },
  loading: {
    gap: spacing.lg,
  },
  skeleton: {
    borderRadius: radius.md,
  },
  totals: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  total: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    ...elevation.card,
  },
  card: {
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    ...elevation.card,
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.md,
    minHeight: layout.touchTarget,
  },
  divider: {
    borderTopWidth: layout.hairline,
    borderTopColor: colors.outline,
  },
  pressed: {
    opacity: layout.pressedOpacity,
  },
  rank: {
    width: spacing.xxl,
    height: spacing.xxl,
    borderRadius: radius.pill,
    backgroundColor: colors.secondarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankBody: {
    flex: 1,
    gap: spacing.xs,
  },
  rankHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  flex: {
    flex: 1,
  },
  barRow: {
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
}));
