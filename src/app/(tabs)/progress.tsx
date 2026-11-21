import { useIsFocused, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { AppIcon } from '@/components/AppIcon';
import type { IconName } from '@/components/AppIcon';
import { AppIconButton } from '@/components/AppIconButton';
import { AppText } from '@/components/AppText';
import { Badge, BestScoreBadge, Meter, VisitedBadge } from '@/components/Badges';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { CoverImage } from '@/components/CoverImage';
import { FavoriteButton } from '@/components/FavoriteButton';
import { ProgressRing } from '@/components/ProgressRing';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SectionHeader } from '@/components/SectionHeader';
import { Skeleton } from '@/components/Skeleton';
import { EmptyState, ErrorState } from '@/components/StateViews';
import { ThemedStatusBar } from '@/components/ThemedStatusBar';
import { useFavorites } from '@/context/FavoritesContext';
import { useIdentity } from '@/context/IdentityContext';
import { useToast } from '@/context/ToastContext';
import { useDestinations } from '@/hooks/useDestinations';
import { useProgressSummary } from '@/hooks/useProgress';
import { favoriteDestinations } from '@/lib/favorites';
import { toAppError } from '@/lib/errors';
import { formatPlace } from '@/lib/format';
import type { DestinationProgress, ProgressSummary } from '@/lib/progress';
import type { DestinationSummary } from '@/types/database';
import { layout, radius, spacing, iconSize } from '@/theme';
import { makeStyles, useAppTheme } from '@/theme/ThemeProvider';
import { useI18n } from '@/context/I18nContext';

export default function ProgressScreen() {
  const styles = useStyles();
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const router = useRouter();
  const isFocused = useIsFocused();
  const summary = useProgressSummary();

  return (
    <View style={styles.screen}>
      {isFocused ? <ThemedStatusBar /> : null}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={summary.isRefreshing}
            onRefresh={summary.refresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
            progressBackgroundColor={colors.surface}
          />
        }>
        <ScreenHeader
          overline={t('progress.overline')}
          title={t('progress.title')}
          action={
            <AppIconButton
              icon="cog-outline"
              mode="contained"
              size={iconSize.md}
              containerColor={colors.surface}
              iconColor={colors.ink}
              onPress={() => router.push('/settings')}
              accessibilityLabel={t('settings.openA11y')}
              style={styles.gear}
            />
          }
        />

        <View style={styles.body}>
          <IdentityCard />

          {summary.status === 'loading' ? (
            <ProgressSkeleton />
          ) : summary.status === 'error' && summary.error ? (
            <ErrorState error={summary.error} onRetry={summary.retry} />
          ) : summary.data ? (
            <ProgressBody
              summary={summary.data}
              onOpen={(id) => router.push({ pathname: '/destination/[id]', params: { id } })}
              onExplore={() => router.navigate('/explore')}
            />
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

/** Who is signed in — or a gentle nudge for guests. */
function IdentityCard() {
  const styles = useStyles();
  const { t, errorMessage } = useI18n();
  const router = useRouter();
  const identity = useIdentity();
  const { showToast } = useToast();
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [busy, setBusy] = useState(false);
  const isUser = identity.kind === 'user';

  const signOut = async () => {
    setBusy(true);
    try {
      // The root stack returns to Welcome once the session is gone.
      await identity.signOut();
    } catch (cause) {
      showToast(errorMessage(toAppError(cause, 'signOut')));
      setBusy(false);
      setConfirmSignOut(false);
    }
  };

  return (
    <View style={styles.identity}>
      <View style={styles.identityRow}>
        <View style={[styles.avatar, isUser ? styles.avatarUser : styles.avatarGuest]}>
          {isUser ? (
            <AppText variant="monogram" color="onPrimary">
              {(identity.email ?? '?').charAt(0).toUpperCase()}
            </AppText>
          ) : (
            <AppIcon name="account-outline" size="lg" color="secondaryDark" />
          )}
        </View>
        <View style={styles.flex}>
          <AppText variant="subtitle" numberOfLines={1} accessibilityLabel={isUser ? t('progress.signedInAs', { email: identity.label }) : t('progress.guestA11y')}>
            {isUser ? identity.label : t('progress.guest')}
          </AppText>
          <AppText variant="caption" color="inkSoft">
            {isUser ? t('progress.signedInNote') : t('progress.guestNote')}
          </AppText>
        </View>
        {isUser ? (
          <AppButton label={t('progress.signOut')} icon="logout" variant="text" onPress={() => setConfirmSignOut(true)} />
        ) : null}
      </View>

      {!isUser ? (
        <View style={styles.nudge}>
          <AppText variant="body" color="inkSoft">
            {t('progress.nudge')}
          </AppText>
          <View style={styles.nudgeActions}>
            <AppButton
              label={t('progress.createAccount')}
              icon="account-plus-outline"
              onPress={() => router.push('/sign-up')}
              style={styles.nudgeButton}
            />
            <AppButton label={t('progress.signIn')} variant="text" onPress={() => router.push('/sign-in')} />
          </View>
        </View>
      ) : null}

      <ConfirmDialog
        visible={confirmSignOut}
        title={t('progress.signOutDialog.title')}
        message={t('progress.signOutDialog.message')}
        confirmLabel={t('progress.signOut')}
        busy={busy}
        onConfirm={signOut}
        onCancel={() => setConfirmSignOut(false)}
      />
    </View>
  );
}

function ProgressBody({
  summary,
  onOpen,
  onExplore,
}: {
  summary: ProgressSummary;
  onOpen: (id: string) => void;
  onExplore: () => void;
}) {
  const styles = useStyles();
  const { t, provinceTagline } = useI18n();
  const share = summary.totalDestinations > 0 ? summary.visitedCount / summary.totalDestinations : 0;

  return (
    <>
      {/* Overview */}
      <View style={styles.overview}>
        <View style={styles.overviewTop}>
          <ProgressRing
            progress={share}
            color="success"
            accessibilityLabel={t('progress.ringA11y', { visited: summary.visitedCount, total: summary.totalDestinations })}>
            <AppText variant="stat" color="success">
              {summary.visitedCount}
              <AppText variant="subtitle" color="muted">
                /{summary.totalDestinations}
              </AppText>
            </AppText>
            <AppText variant="caption" color="inkSoft">
              {t('progress.visited')}
            </AppText>
          </ProgressRing>
          <View style={styles.overviewText}>
            <AppText variant="overline" color="secondaryDark">
              {t('progress.completed')}
            </AppText>
            <AppText variant="sectionTitle">{t('progress.shareOfRegion', { percent: Math.round(share * 100) })}</AppText>
            <AppText variant="body" color="inkSoft">
              {summary.visitedCount === summary.totalDestinations && summary.totalDestinations > 0
                ? t('progress.allVisited')
                : t('progress.fillRing')}
            </AppText>
          </View>
        </View>

        <View style={styles.stats}>
          <StatTile icon="clipboard-check-outline" label={t('progress.quizzesTaken')} value={String(summary.quizzesTaken)} />
          <StatTile
            icon="chart-line"
            label={t('progress.averageScore')}
            value={summary.averagePercent === null ? '—' : `${summary.averagePercent}%`}
          />
          <StatTile
            icon="trophy-outline"
            label={t('progress.bestScore')}
            value={summary.best ? `${summary.best.score}/${summary.best.total}` : '—'}
          />
        </View>
      </View>

      <FavoritesSection onOpen={onOpen} onExplore={onExplore} />

      {/* Provinces */}
      <SectionHeader inset={false} title={t('progress.byProvince.title')} subtitle={t('progress.byProvince.subtitle')} />
      <View style={styles.card}>
        {summary.provinces.map((row, index) => (
          <View key={row.province} style={[styles.provinceRow, index > 0 && styles.divider]}>
            <View style={styles.provinceHead}>
              <View style={styles.flex}>
                <AppText variant="subtitle">{row.province}</AppText>
                <AppText variant="caption" color="muted">
                  {provinceTagline(row.province)}
                </AppText>
              </View>
              <AppText variant="label" color={row.total > 0 && row.visited === row.total ? 'success' : 'inkSoft'}>
                {t('progress.byProvince.ofTotal', { visited: row.visited, total: row.total })}
              </AppText>
            </View>
            <Meter
              value={row.total > 0 ? row.visited / row.total : 0}
              color={row.total > 0 && row.visited === row.total ? 'success' : 'secondary'}
              accessibilityLabel={t('progress.byProvince.a11y', { province: row.province, visited: row.visited, total: row.total })}
            />
          </View>
        ))}
      </View>

      {/* Journey */}
      <SectionHeader inset={false} title={t('progress.journey.title')} subtitle={t('progress.journey.subtitle')} />
      {summary.journey.length === 0 ? (
        <View style={styles.card}>
          <EmptyState
            icon="map-legend"
            title={t('progress.journey.emptyTitle')}
            message={t('progress.journey.emptyMessage')}
            actionLabel={t('progress.journey.emptyAction')}
            actionIcon="compass-outline"
            onAction={onExplore}
          />
        </View>
      ) : (
        <View style={styles.journey}>
          {summary.journey.map((item) => (
            <JourneyRow key={item.destination.id} item={item} onPress={() => onOpen(item.destination.id)} />
          ))}
        </View>
      )}
    </>
  );
}

/** Places the user hearted, newest first. Unhearting here removes them at once. */
function FavoritesSection({ onOpen, onExplore }: { onOpen: (id: string) => void; onExplore: () => void }) {
  const styles = useStyles();
  const { t } = useI18n();
  const favorites = useFavorites();
  const catalogue = useDestinations({});
  const saved = favoriteDestinations(catalogue.data ?? [], favorites.entries);
  const isLoading = !favorites.isReady || catalogue.status === 'loading';

  return (
    <>
      <SectionHeader
        inset={false}
        title={t('progress.favorites.title')}
        subtitle={
          saved.length > 0
            ? t('progress.favorites.subtitle', { count: saved.length })
            : t('progress.favorites.subtitleEmpty')
        }
      />
      {isLoading ? (
        <Skeleton height={layout.iconBadge * 2 + spacing.xl} style={styles.skeletonCard} />
      ) : saved.length === 0 ? (
        <View style={styles.card}>
          <EmptyState
            icon="heart-outline"
            title={t('progress.favorites.emptyTitle')}
            message={t('progress.favorites.emptyMessage')}
            actionLabel={t('progress.favorites.emptyAction')}
            actionIcon="compass-outline"
            onAction={onExplore}
          />
        </View>
      ) : (
        <View style={styles.journey}>
          {saved.map((destination) => (
            <FavoriteRow key={destination.id} destination={destination} onPress={() => onOpen(destination.id)} />
          ))}
        </View>
      )}
    </>
  );
}

function FavoriteRow({ destination, onPress }: { destination: DestinationSummary; onPress: () => void }) {
  const styles = useStyles();
  const { t } = useI18n();
  return (
    <View style={styles.row}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${destination.name}, ${formatPlace(destination)}`}
        accessibilityHint={t('common.opensDetails')}
        style={({ pressed }) => [styles.favoriteMain, pressed && styles.pressed]}>
        <CoverImage uri={destination.cover_image_url} label={t('common.photoOf', { name: destination.name })} style={styles.thumb} />
        <View style={styles.rowBody}>
          <AppText variant="cardTitleSmall" numberOfLines={2}>
            {destination.name}
          </AppText>
          <AppText variant="caption" color="inkSoft" numberOfLines={1}>
            {formatPlace(destination)}
          </AppText>
        </View>
      </Pressable>
      <FavoriteButton destinationId={destination.id} name={destination.name} tone="plain" />
    </View>
  );
}

function StatTile({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  const styles = useStyles();
  const { t } = useI18n();
  return (
    <View style={styles.stat} accessible accessibilityLabel={t('progress.statA11y', { label, value })}>
      <AppIcon name={icon} size="sm" color="secondaryDark" />
      <AppText variant="stat">{value}</AppText>
      <AppText variant="caption" color="inkSoft" align="center">
        {label}
      </AppText>
    </View>
  );
}

function JourneyRow({ item, onPress }: { item: DestinationProgress; onPress: () => void }) {
  const styles = useStyles();
  const { t } = useI18n();
  const { destination, visited, best, attempts } = item;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('progress.journey.rowA11y', {
        name: destination.name,
        visited: t(visited ? 'progress.journey.rowVisited' : 'progress.journey.rowNotVisited'),
        quiz: best
          ? t('progress.journey.rowBest', { score: best.score, total: best.total })
          : t('progress.journey.rowNoQuiz'),
      })}
      accessibilityHint={t('common.opensDetails')}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <CoverImage uri={destination.cover_image_url} label={t('common.photoOf', { name: destination.name })} style={styles.thumb} />
      <View style={styles.rowBody}>
        <AppText variant="cardTitleSmall" numberOfLines={2}>
          {destination.name}
        </AppText>
        <AppText variant="caption" color="inkSoft" numberOfLines={1}>
          {formatPlace(destination)}
        </AppText>
        <View style={styles.rowBadges}>
          {visited ? <VisitedBadge /> : <Badge icon="walk" label={t('progress.journey.tourNotFinished')} />}
          {best ? (
            <BestScoreBadge score={best.score} total={best.total} />
          ) : (
            <Badge icon="help-circle-outline" label={t('progress.journey.noQuiz')} />
          )}
        </View>
        {attempts > 1 ? (
          <AppText variant="caption" color="muted">
            {t('progress.journey.attempts', { count: attempts })}
          </AppText>
        ) : null}
      </View>
      <AppIcon name="chevron-right" size="md" color="muted" />
    </Pressable>
  );
}

function ProgressSkeleton() {
  const styles = useStyles();
  const { t } = useI18n();
  return (
    <View style={styles.skeleton} accessible accessibilityLabel={t('progress.loadingA11y')}>
      <Skeleton height={layout.progressRingSize + spacing.huge} style={styles.skeletonCard} />
      <Skeleton height={spacing.xl} width="50%" />
      <Skeleton height={layout.progressRingSize} style={styles.skeletonCard} />
    </View>
  );
}

const useStyles = makeStyles(({ colors, elevation }) => ({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  gear: {
    margin: 0,
  },
  scroll: {
    paddingBottom: layout.snackbarOffset,
  },
  body: {
    paddingHorizontal: spacing.lg,
    gap: spacing.xl,
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
  },
  flex: {
    flex: 1,
  },
  pressed: {
    opacity: layout.pressedOpacity,
  },
  // Identity
  identity: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    ...elevation.card,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: layout.iconBadge + spacing.xs,
    height: layout.iconBadge + spacing.xs,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarUser: {
    backgroundColor: colors.primary,
  },
  avatarGuest: {
    backgroundColor: colors.secondarySoft,
  },
  nudge: {
    gap: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: layout.hairline,
    borderTopColor: colors.outline,
  },
  nudgeActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
  },
  // Grows to fill the row, and wraps "Sign in" below it when the text is large.
  nudgeButton: {
    flexGrow: 1,
  },
  // Overview
  overview: {
    gap: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    ...elevation.card,
  },
  overviewTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    flexWrap: 'wrap',
  },
  overviewText: {
    flex: 1,
    // Wide enough that "4% of CALABARZON" moves under the ring instead of breaking mid-word.
    minWidth: layout.overviewTextMinWidth,
    gap: spacing.xs,
  },
  stats: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: colors.background,
  },
  // Provinces
  card: {
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    ...elevation.card,
  },
  provinceRow: {
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  provinceHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  divider: {
    borderTopWidth: layout.hairline,
    borderTopColor: colors.outline,
  },
  // Journey
  journey: {
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    ...elevation.card,
  },
  thumb: {
    width: layout.iconBadge * 2,
    height: layout.iconBadge * 2,
    borderRadius: radius.sm,
  },
  rowBody: {
    flex: 1,
    gap: spacing.xs,
  },
  favoriteMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  rowBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  skeleton: {
    gap: spacing.lg,
  },
  skeletonCard: {
    borderRadius: radius.md,
  },
}));
