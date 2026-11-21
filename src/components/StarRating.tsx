/**
 * Star ratings (Run 6): the five-star input on Details and the compact
 * "★ 4.6 (12)" label on Explore cards. Stars are filled vs outlined (shape,
 * not only colour) and every value is also spelled out for screen readers.
 */
import { Pressable, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { AppIcon } from '@/components/AppIcon';
import { AppText } from '@/components/AppText';
import { useI18n } from '@/context/I18nContext';
import { MAX_STARS, formatAverage } from '@/lib/ratings';
import type { RatingSummary } from '@/lib/ratings';
import { layout, radius, spacing } from '@/theme';
import { makeStyles } from '@/theme/ThemeProvider';

type InputProps = {
  value: number | null;
  onChange: (stars: number) => void;
  disabled?: boolean;
};

/** Five 48 dp star buttons; the user's own rating is filled. */
export function StarRatingInput({ value, onChange, disabled = false }: InputProps) {
  const styles = useStyles();
  const { t } = useI18n();
  return (
    <View style={styles.row} accessibilityRole="radiogroup">
      {Array.from({ length: MAX_STARS }, (_, index) => {
        const stars = index + 1;
        const filled = value !== null && stars <= value;
        return (
          <Pressable
            key={stars}
            onPress={() => onChange(stars)}
            disabled={disabled}
            accessibilityRole="radio"
            accessibilityState={{ checked: value === stars, disabled }}
            accessibilityLabel={t('ratings.starA11y', { count: stars })}
            style={({ pressed }) => [styles.star, pressed && styles.pressed, disabled && styles.disabled]}>
            <AppIcon name={filled ? 'star' : 'star-outline'} size="lg" color={filled ? 'secondaryDark' : 'muted'} />
          </Pressable>
        );
      })}
    </View>
  );
}

/** "★ 4.6 (12)" — nothing when there are no ratings. */
export function RatingInline({ summary, style }: { summary: RatingSummary | null | undefined; style?: StyleProp<ViewStyle> }) {
  const styles = useStyles();
  const { t } = useI18n();
  if (!summary) return null;
  const average = formatAverage(summary.average);
  return (
    <View
      style={[styles.inline, style]}
      accessible
      accessibilityLabel={t('ratings.cardA11y', { average, count: summary.count })}>
      <AppIcon name="star" size="xs" color="secondaryDark" />
      <AppText variant="label" color="secondaryDark">
        {average}
      </AppText>
      <AppText variant="caption" color="inkSoft">
        ({summary.count})
      </AppText>
    </View>
  );
}

const useStyles = makeStyles(() => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  star: {
    width: layout.starTarget,
    height: layout.starTarget,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: layout.pressedOpacity,
  },
  disabled: {
    opacity: 0.5,
  },
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
}));
