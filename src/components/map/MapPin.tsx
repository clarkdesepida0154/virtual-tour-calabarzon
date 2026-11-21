import { View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';

import { AppIcon } from '@/components/AppIcon';
import { CATEGORY_META } from '@/constants/taxonomy';
import type { Category } from '@/constants/taxonomy';
import { layout, radius } from '@/theme';
import { makeStyles, useAppTheme } from '@/theme/ThemeProvider';

type Props = {
  category: Category;
  selected?: boolean;
  /** Fires once the pin has laid out — the native marker then stops re-rendering it. */
  onLayout?: (event: LayoutChangeEvent) => void;
};

/**
 * The design-system map pin: a round head in the category's colour carrying
 * the category icon, on a short pointer whose tip marks the exact spot. The
 * rim and icon use `pinRim` (white on the light map, deep brown on the dark
 * map), so the pin separates from either base map. Selected pins grow and
 * lift. Shared by the native map (as a custom Marker view) and the web
 * stand-in.
 */
export function MapPin({ category, selected = false, onLayout }: Props) {
  const styles = useStyles();
  const { colors } = useAppTheme();
  const fill = colors[CATEGORY_META[category].color];
  const head = selected ? layout.pinHeadSelected : layout.pinHead;

  return (
    <View style={styles.wrap} onLayout={onLayout} collapsable={false}>
      <View
        style={[
          styles.head,
          { width: head, height: head, backgroundColor: fill },
          selected && styles.headSelected,
        ]}>
        <AppIcon name={CATEGORY_META[category].icon} size={selected ? 'sm' : 'xs'} color="pinRim" />
      </View>
      <View style={[styles.pointer, { borderTopColor: fill }]} />
    </View>
  );
}

const useStyles = makeStyles(({ colors, elevation }) => ({
  wrap: {
    alignItems: 'center',
    // Room for the selected pin's shadow, so the marker bitmap never clips it.
    padding: layout.pinShadowRoom,
  },
  head: {
    borderRadius: radius.pill,
    borderWidth: layout.pinRimWidth,
    borderColor: colors.pinRim,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation.card,
  },
  headSelected: {
    ...elevation.raised,
  },
  pointer: {
    width: 0,
    height: 0,
    marginTop: -layout.pinRimWidth,
    borderLeftWidth: layout.pinPointer / 2,
    borderRightWidth: layout.pinPointer / 2,
    borderTopWidth: layout.pinPointer,
    borderLeftColor: colors.transparent,
    borderRightColor: colors.transparent,
  },
}));
