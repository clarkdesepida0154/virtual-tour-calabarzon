/**
 * Badge celebrations (Run 6).
 *
 * `checkAchievements()` re-evaluates the badge rules for the current user
 * (after a quiz, after "Mark as Visited", and when the Progress tab loads).
 * Any badge earned now that is not in the user's "seen" list (AsyncStorage,
 * per user key) gets a short, non-blocking banner + a success haptic, and is
 * then marked seen — so each celebration fires once.
 *
 * The banner sits below the screens' top bars and never blocks the rest of
 * the screen (no modal), so it cannot get in the way of the flow underneath.
 */
import { useRouter } from 'expo-router';
import { createContext, use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppIcon } from '@/components/AppIcon';
import type { IconName } from '@/components/AppIcon';
import { AppIconButton } from '@/components/AppIconButton';
import { AppText } from '@/components/AppText';
import { useI18n } from '@/context/I18nContext';
import { useIdentity } from '@/context/IdentityContext';
import { loadAchievementInput } from '@/hooks/useAchievements';
import { evaluateBadges, newlyEarned, parseSeenBadges } from '@/lib/achievements';
import type { BadgeStatus } from '@/lib/achievements';
import { successFeedback } from '@/lib/device';
import { readSeenBadgesRaw, writeSeenBadges } from '@/lib/localPrefs';
import { iconSize, layout, motion, radius, spacing } from '@/theme';
import { makeStyles, useAppTheme } from '@/theme/ThemeProvider';

type AchievementsValue = {
  /** Re-checks the badge rules and celebrates anything newly earned. Never throws. */
  checkAchievements: () => void;
};

const AchievementsContext = createContext<AchievementsValue | null>(null);

type Celebration = { id: number; first: BadgeStatus; more: number };

export function AchievementsProvider({ children }: { children: ReactNode }) {
  const { userKey, isReady } = useIdentity();
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  const running = useRef(false);
  const again = useRef(false);

  const run = useCallback(async () => {
    if (!userKey) return;
    if (running.current) {
      again.current = true;
      return;
    }
    running.current = true;
    try {
      do {
        again.current = false;
        const key = userKey;
        const [input, seenRaw] = await Promise.all([loadAchievementInput(key), readSeenBadgesRaw(key)]);
        const statuses = evaluateBadges(input);
        const seen = parseSeenBadges(seenRaw);
        const fresh = newlyEarned(statuses, seen);
        if (fresh.length > 0) {
          await writeSeenBadges(key, [...seen, ...fresh.map((entry) => entry.badge.id)]);
          successFeedback();
          setCelebration({ id: Date.now(), first: fresh[0], more: fresh.length - 1 });
        }
      } while (again.current);
    } catch {
      // Offline or a failed read: nothing to celebrate now; the next check retries.
    } finally {
      running.current = false;
    }
  }, [userKey]);

  const checkAchievements = useCallback(() => {
    if (isReady) void run();
  }, [isReady, run]);

  // Auto-dismiss.
  useEffect(() => {
    if (!celebration) return;
    const timer = setTimeout(() => setCelebration(null), motion.celebration);
    return () => clearTimeout(timer);
  }, [celebration]);

  const value = useMemo(() => ({ checkAchievements }), [checkAchievements]);

  return (
    <AchievementsContext value={value}>
      {children}
      {celebration ? (
        <CelebrationBanner key={celebration.id} celebration={celebration} onClose={() => setCelebration(null)} />
      ) : null}
    </AchievementsContext>
  );
}

function CelebrationBanner({ celebration, onClose }: { celebration: Celebration; onClose: () => void }) {
  const styles = useStyles();
  const { colors } = useAppTheme();
  const { t } = useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { first, more } = celebration;
  const title = t(`achievements.badges.${first.badge.key}.title`);

  return (
    <View style={[styles.layer, { top: insets.top + layout.topBarHeight + spacing.sm }]} pointerEvents="box-none">
      <Animated.View
        entering={FadeInUp.duration(motion.normal)}
        exiting={FadeOutUp.duration(motion.normal)}
        style={styles.banner}
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        accessibilityLabel={t('achievements.celebrateA11y', { title })}>
        <View style={styles.medal}>
          <AppIcon name={first.badge.icon as IconName} size="lg" color="secondaryDark" />
        </View>
        <View style={styles.text}>
          <AppText variant="overline" color="secondaryDark">
            {t('achievements.celebrateOverline')}
          </AppText>
          <AppText variant="cardTitleSmall" numberOfLines={2}>
            {title}
          </AppText>
          {more > 0 ? (
            <AppText variant="caption" color="inkSoft">
              {t('achievements.celebrateMore', { count: more })}
            </AppText>
          ) : null}
        </View>
        <Pressable
          onPress={() => {
            onClose();
            router.push('/badges');
          }}
          accessibilityRole="button"
          accessibilityLabel={t('achievements.celebrateViewA11y')}
          hitSlop={spacing.sm}
          style={({ pressed }) => [styles.view, pressed && styles.pressed]}>
          <AppText variant="label" color="primary">
            {t('achievements.celebrateView')}
          </AppText>
        </Pressable>
        <AppIconButton
          icon="close"
          compact
          size={iconSize.sm}
          iconColor={colors.inkSoft}
          onPress={onClose}
          accessibilityLabel={t('achievements.dismiss')}
          style={styles.close}
        />
      </Animated.View>
    </View>
  );
}

export function useAchievementsCheck(): AchievementsValue {
  const value = use(AchievementsContext);
  if (!value) throw new Error('useAchievementsCheck must be used inside <AchievementsProvider>.');
  return value;
}

const useStyles = makeStyles(({ colors, elevation }) => ({
  layer: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    alignItems: 'center',
  },
  banner: {
    width: '100%',
    maxWidth: layout.maxContentWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: layout.hairline,
    borderColor: colors.secondary,
    ...elevation.raised,
  },
  medal: {
    width: layout.iconBadge + spacing.xs,
    height: layout.iconBadge + spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.secondarySoft,
    borderWidth: 2,
    borderColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
    gap: spacing.xs / 2,
  },
  view: {
    minHeight: layout.touchTargetCompact,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  pressed: {
    opacity: layout.pressedOpacity,
  },
  close: {
    margin: 0,
  },
}));
