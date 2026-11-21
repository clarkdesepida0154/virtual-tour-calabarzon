/**
 * Badges (Run 6) — reached from the Progress tab. A grid of the 10 badges:
 * earned ones in full colour with the date of the row that earned them,
 * locked ones as a muted outline with their progress. State is spelled out
 * in words and icons, never by colour alone.
 */
import { useRouter } from 'expo-router';
import { RefreshControl, ScrollView, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { AppIcon } from '@/components/AppIcon';
import type { IconName } from '@/components/AppIcon';
import { AppText } from '@/components/AppText';
import { Meter } from '@/components/Badges';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Skeleton } from '@/components/Skeleton';
import { ErrorState } from '@/components/StateViews';
import { ThemedStatusBar } from '@/components/ThemedStatusBar';
import type { Province } from '@/constants/taxonomy';
import { useI18n } from '@/context/I18nContext';
import { useAchievements } from '@/hooks/useAchievements';
import { BADGE_THRESHOLDS, earnedCount } from '@/lib/achievements';
import type { BadgeStatus } from '@/lib/achievements';
import { layout, radius, spacing } from '@/theme';
import { makeStyles, useAppTheme } from '@/theme/ThemeProvider';

export default function BadgesScreen() {
  const styles = useStyles();
  const { colors } = useAppTheme();
  const { t } = useI18n();
  const router = useRouter();
  const query = useAchievements();
  const data = query.data;

  const leave = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/progress');
  };

  /** The {{count}} each badge's description needs. */
  const countFor = (entry: BadgeStatus): number => {
    const rule = entry.badge.rule;
    switch (rule.kind) {
      case 'province':
        return data?.provinceCounts[rule.province as Province] ?? entry.target;
      case 'all-visited':
        return data?.destinationCount ?? entry.target;
      case 'perfect-quizzes':
        return BADGE_THRESHOLDS.perfectQuizzes;
      case 'attempts':
        return BADGE_THRESHOLDS.attempts;
      case 'favorites':
        return BADGE_THRESHOLDS.favorites;
      default:
        return rule.count;
    }
  };

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
        <ScreenHeader
          overline={t('achievements.overline')}
          title={t('achievements.title')}
          subtitle={t('achievements.subtitle')}
          onBack={leave}
        />
        <View style={styles.body}>
          {query.status === 'error' && query.error ? (
            <ErrorState error={query.error} onRetry={query.retry} />
          ) : !data ? (
            <View style={styles.grid} accessible accessibilityLabel={t('achievements.loadingA11y')}>
              {Array.from({ length: 4 }, (_, index) => (
                <Skeleton key={index} height={layout.badgeMedal * 3} style={styles.skeleton} />
              ))}
            </View>
          ) : (
            <>
              <View style={styles.summary}>
                <AppIcon name="medal-outline" size="md" color="secondaryDark" />
                <AppText variant="subtitle">
                  {t('achievements.entrySubtitle', { earned: earnedCount(data.badges), total: data.badges.length })}
                </AppText>
              </View>
              <View style={styles.grid}>
                {data.badges.map((entry) => (
                  <BadgeTile
                    key={entry.badge.id}
                    entry={entry}
                    count={countFor(entry)}
                    onCertificate={
                      entry.earned && entry.badge.certificate
                        ? () => router.push({ pathname: '/certificate', params: { scope: entry.badge.certificate! } })
                        : undefined
                    }
                  />
                ))}
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function BadgeTile({ entry, count, onCertificate }: { entry: BadgeStatus; count: number; onCertificate?: () => void }) {
  const styles = useStyles();
  const { t, date } = useI18n();
  const title = t(`achievements.badges.${entry.badge.key}.title`);
  const description = t(`achievements.badges.${entry.badge.key}.description`, { count });
  const earnedDate = date(entry.earnedAt);
  const label = entry.earned
    ? t('achievements.tileEarnedA11y', { title, date: earnedDate || t('achievements.earned'), description })
    : t('achievements.tileLockedA11y', { title, current: entry.current, target: entry.target, description });

  return (
    <View style={[styles.tile, entry.earned ? styles.tileEarned : styles.tileLocked]}>
      <View accessible accessibilityLabel={label} style={styles.tileInfo}>
        <View style={[styles.medal, entry.earned ? styles.medalEarned : styles.medalLocked]}>
          <AppIcon name={entry.badge.icon as IconName} size="lg" color={entry.earned ? 'secondaryDark' : 'muted'} />
          {!entry.earned ? (
            <View style={styles.lock}>
              <AppIcon name="lock" size="xs" color="muted" />
            </View>
          ) : null}
        </View>
        <AppText variant="cardTitleSmall" align="center" color={entry.earned ? 'ink' : 'inkSoft'}>
          {title}
        </AppText>
        <AppText variant="caption" color="inkSoft" align="center">
          {description}
        </AppText>
        {entry.earned ? (
          <View style={styles.status}>
            <AppIcon name="check-decagram" size="xs" color="success" />
            <AppText variant="label" color="success">
              {earnedDate ? t('achievements.earnedOn', { date: earnedDate }) : t('achievements.earned')}
            </AppText>
          </View>
        ) : (
          <View style={styles.lockedStatus}>
            <View style={styles.status}>
              <AppIcon name="lock-outline" size="xs" color="muted" />
              <AppText variant="label" color="muted">
                {t('achievements.locked')} · {t('achievements.progress', { current: entry.current, target: entry.target })}
              </AppText>
            </View>
            <Meter
              value={entry.target > 0 ? entry.current / entry.target : 0}
              color="secondary"
              accessibilityLabel={t('achievements.progress', { current: entry.current, target: entry.target })}
            />
          </View>
        )}
      </View>
      {onCertificate ? (
        <AppButton
          label={t('achievements.viewCertificate')}
          icon="certificate-outline"
          variant="text"
          onPress={onCertificate}
          accessibilityHint={t('achievements.viewCertificateA11y', { title })}
        />
      ) : null}
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
  summary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  skeleton: {
    flexBasis: '46%',
    flexGrow: 1,
    borderRadius: radius.md,
  },
  tile: {
    flexBasis: '46%',
    flexGrow: 1,
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  tileEarned: {
    backgroundColor: colors.surface,
    borderWidth: layout.hairline,
    borderColor: colors.secondary,
    ...elevation.card,
  },
  tileLocked: {
    backgroundColor: colors.background,
    borderWidth: layout.hairline,
    borderStyle: 'dashed',
    borderColor: colors.outlineStrong,
  },
  tileInfo: {
    alignItems: 'center',
    gap: spacing.sm,
    alignSelf: 'stretch',
  },
  medal: {
    width: layout.badgeMedal,
    height: layout.badgeMedal,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  medalEarned: {
    backgroundColor: colors.secondarySoft,
    borderWidth: 2,
    borderColor: colors.secondary,
  },
  medalLocked: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.outlineStrong,
  },
  lock: {
    position: 'absolute',
    right: -spacing.xs,
    bottom: -spacing.xs,
    width: spacing.xl,
    height: spacing.xl,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  status: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs,
  },
  lockedStatus: {
    alignSelf: 'stretch',
    gap: spacing.sm,
  },
}));
