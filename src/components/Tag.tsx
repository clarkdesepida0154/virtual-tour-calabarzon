import { StyleSheet, View } from 'react-native';

import { AppIcon } from '@/components/AppIcon';
import type { IconName } from '@/components/AppIcon';
import { AppText } from '@/components/AppText';
import { CATEGORY_META } from '@/constants/taxonomy';
import type { Category, Province } from '@/constants/taxonomy';
import { colors, elevation, radius, spacing } from '@/theme';

type TagProps = {
  icon: IconName;
  label: string;
  /** `overlay` sits on photos; `soft` and `outline` sit on the page. */
  tone?: 'overlay' | 'soft' | 'outline';
};

/** A small, non-interactive pill that labels a destination. */
export function Tag({ icon, label, tone = 'soft' }: TagProps) {
  return (
    <View style={[styles.tag, styles[tone]]}>
      <AppIcon name={icon} size="xs" color={tone === 'outline' ? 'primary' : 'secondaryDark'} />
      <AppText variant="label" color="ink" numberOfLines={1}>
        {label}
      </AppText>
    </View>
  );
}

export function CategoryTag({ category, tone }: { category: Category; tone?: TagProps['tone'] }) {
  return <Tag icon={CATEGORY_META[category].icon} label={category} tone={tone} />;
}

export function ProvinceTag({ province, tone = 'outline' }: { province: Province; tone?: TagProps['tone'] }) {
  return <Tag icon="map-marker-outline" label={province} tone={tone} />;
}

const styles = StyleSheet.create({
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.transparent,
  },
  overlay: {
    backgroundColor: colors.surface,
    ...elevation.card,
  },
  soft: {
    backgroundColor: colors.secondarySoft,
  },
  outline: {
    backgroundColor: colors.surface,
    borderColor: colors.outlineStrong,
  },
});
