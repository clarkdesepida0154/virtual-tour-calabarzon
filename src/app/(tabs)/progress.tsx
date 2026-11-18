import { useIsFocused, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { AppIcon } from '@/components/AppIcon';
import type { IconName } from '@/components/AppIcon';
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
import { PROVINCE_META } from '@/constants/taxonomy';
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
import { colors, elevation, layout, radius, spacing } from '@/theme';

export default function ProgressScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const summary = useProgressSummary();

  return (
    <View style={styles.screen}>
      {isFocused ? <StatusBar style="dark" /> : null}
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
        <ScreenHeader overline="Your journey" title="Progress" />

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
      showToast(toAppError(cause, 'We couldn’t sign you out.').message);
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
          <AppText variant="subtitle" numberOfLines={1} accessibilityLabel={isUser ? `Signed in as ${identity.label}` : 'Using the app as a guest'}>
            {identity.label}
          </AppText>
          <AppText variant="caption" color="inkSoft">
            {isUser ? 'Signed in · progress saved to your account' : 'Guest · progress saved on this phone'}
          </AppText>
        </View>
        {isUser ? (
          <AppButton label="Sign out" icon="logout" variant="text" onPress={() => setConfirmSignOut(true)} />
        ) : null}
      </View>

      {!isUser ? (
        <View style={styles.nudge}>
          <AppText variant="body" color="inkSoft">
            Create an account to keep your tours and quiz scores with your email — your guest progress
            comes along.
          </AppText>
          <View style={styles.nudgeActions}>
            <AppButton
              label="Create an account"
              icon="account-plus-outline"
              onPress={() => router.push('/sign-up')}
              style={styles.flex}
            />
            <AppButton label="Sign in" variant="text" onPress={() => router.push('/sign-in')} />
          </View>
        </View>
      ) : null}

      <ConfirmDialog
        visible={confirmSignOut}
        title="Sign out?"
        message="Your progress stays safe in your account. Sign in again any time to pick it up."
        confirmLabel="Sign out"
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
  const share = summary.totalDestinations > 0 ? summary.visitedCount / summary.totalDestinations : 0;

  return (
    <>
      {/* Overview */}
      <View style={styles.overview}>
        <View style={styles.overviewTop}>
          <ProgressRing
            progress={share}
            color="success"
            accessibilityLabel={`${summary.visitedCount} of ${summary.totalDestinations} destinations visited`}>
            <AppText variant="stat" color="success">
              {summary.visitedCount}
              <AppText variant="subtitle" color="muted">
                /{summary.totalDestinations}
              </AppText>
            </AppText>
            <AppText variant="caption" color="inkSoft">
              visited
            </AppText>
          </ProgressRing>
          <View style={styles.overviewText}>
            <AppText variant="overline" color="secondaryDark">
              Destinations completed
            </AppText>
            <AppText variant="sectionTitle">{Math.round(share * 100)}% of CALABARZON</AppText>
            <AppText variant="body" color="inkSoft">
              {summary.visitedCount === summary.totalDestinations && summary.totalDestinations > 0
                ? 'Every destination visited. Magnificent!'
                : 'Finish a virtual tour and mark it visited to fill the ring.'}
            </AppText>
          </View>
        </View>

        <View style={styles.stats}>
          <StatTile icon="clipboard-check-outline" label="Quizzes taken" value={String(summary.quizzesTaken)} />
          <StatTile
            icon="chart-line"
            label="Average score"
            value={summary.averagePercent === null ? '—' : `${summary.averagePercent}%`}
          />
          <StatTile
            icon="trophy-outline"
            label="Best score"
            value={summary.best ? `${summary.best.score}/${summary.best.total}` : '—'}
          />
        </View>
      </View>

      <FavoritesSection onOpen={onOpen} onExplore={onExplore} />

      {/* Provinces */}
      <SectionHeader inset={false} title="By province" subtitle="Visited destinations in each of the five provinces" />
      <View style={styles.card}>
        {summary.provinces.map((row, index) => (
          <View key={row.province} style={[styles.provinceRow, index > 0 && styles.divider]}>
            <View style={styles.provinceHead}>
              <View style={styles.flex}>
                <AppText variant="subtitle">{row.province}</AppText>
                <AppText variant="caption" color="muted">
                  {PROVINCE_META[row.province].tagline}
                </AppText>
              </View>
              <AppText variant="label" color={row.total > 0 && row.visited === row.total ? 'success' : 'inkSoft'}>
                {row.visited} of {row.total}
              </AppText>
            </View>
            <Meter
              value={row.total > 0 ? row.visited / row.total : 0}
              color={row.total > 0 && row.visited === row.total ? 'success' : 'secondary'}
              accessibilityLabel={`${row.province}: ${row.visited} of ${row.total} visited`}
            />
          </View>
        ))}
      </View>

      {/* Journey */}
      <SectionHeader inset={false} title="Your journey" subtitle="Places you have toured or been quizzed on" />
      {summary.journey.length === 0 ? (
        <View style={styles.card}>
          <EmptyState
            icon="map-legend"
            title="Your journey starts here"
            message="Open any destination, take its virtual tour and mark it visited — or try its quiz. Everything you do shows up here."
            actionLabel="Explore destinations"
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
  const favorites = useFavorites();
  const catalogue = useDestinations({});
  const saved = favoriteDestinations(catalogue.data ?? [], favorites.entries);
  const isLoading = !favorites.isReady || catalogue.status === 'loading';

  return (
    <>
      <SectionHeader
        inset={false}
        title="Favorites"
        subtitle={
          saved.length > 0
            ? `${saved.length} saved ${saved.length === 1 ? 'place' : 'places'} for your next visit`
            : 'Places you have saved with the heart'
        }
      />
      {isLoading ? (
        <Skeleton height={layout.iconBadge * 2 + spacing.xl} style={styles.skeletonCard} />
      ) : saved.length === 0 ? (
        <View style={styles.card}>
          <EmptyState
            icon="heart-outline"
            title="No favorites yet"
            message="Tap the heart on any destination to keep it here — a shortlist for your next real trip."
            actionLabel="Find a destination"
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
  return (
    <View style={styles.row}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${destination.name}, ${formatPlace(destination)}`}
        accessibilityHint="Opens the destination details"
        style={({ pressed }) => [styles.favoriteMain, pressed && styles.pressed]}>
        <CoverImage uri={destination.cover_image_url} label={`Photo of ${destination.name}`} style={styles.thumb} />
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
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label}: ${value}`}>
      <AppIcon name={icon} size="sm" color="secondaryDark" />
      <AppText variant="stat">{value}</AppText>
      <AppText variant="caption" color="inkSoft" align="center">
        {label}
      </AppText>
    </View>
  );
}

function JourneyRow({ item, onPress }: { item: DestinationProgress; onPress: () => void }) {
  const { destination, visited, best, attempts } = item;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${destination.name}. ${visited ? 'Visited.' : 'Not visited yet.'} ${
        best ? `Best quiz score ${best.score} of ${best.total}.` : 'Quiz not taken.'
      }`}
      accessibilityHint="Opens the destination details"
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <CoverImage uri={destination.cover_image_url} label={`Photo of ${destination.name}`} style={styles.thumb} />
      <View style={styles.rowBody}>
        <AppText variant="cardTitleSmall" numberOfLines={2}>
          {destination.name}
        </AppText>
        <AppText variant="caption" color="inkSoft" numberOfLines={1}>
          {formatPlace(destination)}
        </AppText>
        <View style={styles.rowBadges}>
          {visited ? <VisitedBadge /> : <Badge icon="walk" label="Tour not finished" />}
          {best ? (
            <BestScoreBadge score={best.score} total={best.total} />
          ) : (
            <Badge icon="help-circle-outline" label="No quiz yet" />
          )}
        </View>
        {attempts > 1 ? (
          <AppText variant="caption" color="muted">
            {attempts} quiz attempts
          </AppText>
        ) : null}
      </View>
      <AppIcon name="chevron-right" size="md" color="muted" />
    </Pressable>
  );
}

function ProgressSkeleton() {
  return (
    <View style={styles.skeleton} accessible accessibilityLabel="Loading your progress">
      <Skeleton height={layout.progressRingSize + spacing.huge} style={styles.skeletonCard} />
      <Skeleton height={spacing.xl} width="50%" />
      <Skeleton height={layout.progressRingSize} style={styles.skeletonCard} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
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
    alignItems: 'center',
    gap: spacing.sm,
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
    minWidth: layout.featuredCardWidth / 2,
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
});
