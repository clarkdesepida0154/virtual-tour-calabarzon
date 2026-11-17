import { StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { AppIcon } from '@/components/AppIcon';
import type { IconName } from '@/components/AppIcon';
import { AppText } from '@/components/AppText';
import { colors, layout, radius, spacing } from '@/theme';
import type { ColorToken } from '@/theme';

type Tone = 'success' | 'gold' | 'primary' | 'neutral';

const TONES: Record<Tone, { background: ColorToken; foreground: ColorToken }> = {
  success: { background: 'successSoft', foreground: 'success' },
  gold: { background: 'secondarySoft', foreground: 'secondaryDark' },
  primary: { background: 'primarySoft', foreground: 'primaryDark' },
  neutral: { background: 'surfaceMuted', foreground: 'inkSoft' },
};

type BadgeProps = {
  icon: IconName;
  label: string;
  tone?: Tone;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

/** A small status pill: "Visited", "Best 4/5", and so on. */
export function Badge({ icon, label, tone = 'neutral', accessibilityLabel, style }: BadgeProps) {
  const { background, foreground } = TONES[tone];
  return (
    <View
      style={[styles.badge, { backgroundColor: colors[background] }, style]}
      accessible
      accessibilityLabel={accessibilityLabel ?? label}>
      <AppIcon name={icon} size="xs" color={foreground} />
      <AppText variant="label" color={foreground} numberOfLines={1}>
        {label}
      </AppText>
    </View>
  );
}

export function VisitedBadge({ style }: { style?: StyleProp<ViewStyle> }) {
  return <Badge icon="check-decagram" label="Visited" tone="success" style={style} />;
}

export function BestScoreBadge({
  score,
  total,
  style,
}: {
  score: number;
  total: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Badge
      icon="trophy-outline"
      label={`Best ${score}/${total}`}
      tone="gold"
      accessibilityLabel={`Best quiz score ${score} out of ${total}`}
      style={style}
    />
  );
}

type MeterProps = {
  /** 0–1. */
  value: number;
  color?: ColorToken;
  accessibilityLabel: string;
};

/** A slim horizontal bar, for per-province completion. */
export function Meter({ value, color = 'success', accessibilityLabel }: MeterProps) {
  const clamped = Math.min(1, Math.max(0, value));
  return (
    <View
      style={styles.track}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}>
      <View style={[styles.fill, { width: `${clamped * 100}%`, backgroundColor: colors[color] }]} />
    </View>
  );
}

type PageDotsProps = {
  count: number;
  index: number;
  /** `light` for dots on dark photos. */
  tone?: 'light' | 'dark';
};

/** Gallery position indicator: the active dot stretches into a pill. */
export function PageDots({ count, index, tone = 'light' }: PageDotsProps) {
  if (count <= 1) return null;
  const active: ColorToken = tone === 'light' ? 'onPrimary' : 'primary';
  const idle: ColorToken = tone === 'light' ? 'onExhibitFaint' : 'outlineStrong';
  return (
    <View
      style={styles.dots}
      accessible
      accessibilityLabel={`Photo ${index + 1} of ${count}`}>
      {Array.from({ length: count }, (_, dot) => (
        <View
          key={dot}
          style={[
            styles.dot,
            dot === index && styles.dotActive,
            { backgroundColor: colors[dot === index ? active : idle] },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  track: {
    height: layout.meterHeight,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radius.pill,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dot: {
    width: layout.pageDot,
    height: layout.pageDot,
    borderRadius: radius.pill,
  },
  dotActive: {
    width: layout.pageDotActive,
  },
});
