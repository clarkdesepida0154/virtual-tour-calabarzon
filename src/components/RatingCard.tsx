/**
 * "Rate this destination" on Details (Run 6): the five-star input (the
 * user's own rating highlighted, tap again to change it — an upsert) and the
 * community average with its count. Offline, the input hides and the last
 * saved average is shown with a short note.
 */
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { AppIcon } from '@/components/AppIcon';
import { AppText } from '@/components/AppText';
import { StarRatingInput } from '@/components/StarRating';
import { useI18n } from '@/context/I18nContext';
import { useIdentity } from '@/context/IdentityContext';
import { useToast } from '@/context/ToastContext';
import { useDestinationRating } from '@/hooks/useRatings';
import { useShowingSavedData } from '@/lib/appCache';
import { tapFeedback } from '@/lib/device';
import { toAppError } from '@/lib/errors';
import { formatAverage } from '@/lib/ratings';
import { ratingsRepository } from '@/repositories';
import { layout, radius, spacing } from '@/theme';
import { makeStyles, useAppTheme } from '@/theme/ThemeProvider';

export function RatingCard({ destinationId }: { destinationId: string }) {
  const styles = useStyles();
  const { colors } = useAppTheme();
  const { t, errorMessage } = useI18n();
  const { userKey } = useIdentity();
  const { showToast } = useToast();
  const offline = useShowingSavedData();
  const query = useDestinationRating(destinationId);
  // The tap shows at once; the saved value replaces it after the reload.
  const [optimistic, setOptimistic] = useState<{ key: string; stars: number } | null>(null);
  const [saving, setSaving] = useState(false);

  const stateKey = `${userKey}:${destinationId}`;
  const pending = optimistic?.key === stateKey ? optimistic.stars : null;
  const mine = pending ?? query.data?.mine ?? null;
  const summary = query.data?.summary ?? null;

  const rate = async (stars: number) => {
    if (saving) return;
    tapFeedback();
    setOptimistic({ key: stateKey, stars });
    setSaving(true);
    try {
      await ratingsRepository.rate(userKey, destinationId, stars);
      showToast(t('ratings.saved'));
      query.retry();
    } catch (cause) {
      setOptimistic(null);
      showToast(errorMessage(toAppError(cause, 'saveRating')));
    } finally {
      setSaving(false);
    }
  };

  // While a new rating saves, show the average as it will be (own rating swapped in).
  const shown =
    pending !== null && summary && query.data
      ? adjusted(summary.average, summary.count, query.data.mine, pending)
      : pending !== null && !summary
        ? { average: pending, count: 1 }
        : summary;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.icon}>
          <AppIcon name="star-outline" size="sm" color="secondaryDark" />
        </View>
        <View style={styles.flex}>
          <AppText variant="sectionTitle" accessibilityRole="header">
            {t('ratings.title')}
          </AppText>
          {!offline ? (
            <AppText variant="caption" color="inkSoft">
              {t('ratings.subtitle')}
            </AppText>
          ) : null}
        </View>
        {saving ? <ActivityIndicator color={colors.primary} /> : null}
      </View>

      {shown ? (
        <View
          style={styles.summary}
          accessible
          accessibilityLabel={t('ratings.summaryA11y', { average: formatAverage(shown.average), count: shown.count })}>
          <AppText variant="stat">{formatAverage(shown.average)}</AppText>
          <View>
            <AppText variant="label" color="inkSoft">
              {t('ratings.average', { average: formatAverage(shown.average) })}
            </AppText>
            <AppText variant="caption" color="muted">
              {t('ratings.count', { count: shown.count })}
            </AppText>
          </View>
        </View>
      ) : query.status === 'success' || query.status === 'error' ? (
        <AppText variant="body" color="inkSoft">
          {t('ratings.noRatings')}
        </AppText>
      ) : null}

      {offline ? (
        <View style={styles.note}>
          <AppIcon name="cloud-off-outline" size="sm" color="inkSoft" />
          <AppText variant="caption" color="inkSoft" style={styles.flex}>
            {t('ratings.offline')}
          </AppText>
        </View>
      ) : (
        <>
          <StarRatingInput value={mine} onChange={(stars) => void rate(stars)} disabled={saving || query.status === 'loading'} />
          <AppText variant="caption" color={mine ? 'secondaryDark' : 'muted'}>
            {mine ? t('ratings.yours', { stars: mine }) : t('ratings.none')}
          </AppText>
        </>
      )}
    </View>
  );
}

/** The average after replacing the user's previous rating (if any) with `next`. */
function adjusted(average: number, count: number, previous: number | null, next: number) {
  const total = average * count - (previous ?? 0) + next;
  const newCount = previous === null ? count + 1 : count;
  return newCount > 0 ? { average: total / newCount, count: newCount } : { average, count };
}

const useStyles = makeStyles(({ colors, elevation }) => ({
  card: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    ...elevation.card,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  icon: {
    width: spacing.xxl + spacing.xs,
    height: spacing.xxl + spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.secondarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: {
    flex: 1,
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted,
    borderWidth: layout.hairline,
    borderColor: colors.outline,
  },
}));
