import { View } from 'react-native';

import { AppIcon } from '@/components/AppIcon';
import { AppText } from '@/components/AppText';
import { layout, radius } from '@/theme';
import { makeStyles } from '@/theme/ThemeProvider';

/**
 * A numbered field-trip stop (Run 6): terracotta disc with the stop number,
 * on the same pointer as the category pins. `start` draws the "you are here"
 * origin instead (a gold disc with a person icon).
 */
export function TripPin({ number, start = false }: { number?: number; start?: boolean }) {
  const styles = useStyles();
  return (
    <View style={styles.wrap} collapsable={false}>
      <View style={[styles.head, start ? styles.headStart : styles.headStop]}>
        {start ? (
          <AppIcon name="account" size="xs" color="pinRim" />
        ) : (
          <AppText variant="label" color="onPrimary">
            {number}
          </AppText>
        )}
      </View>
      <View style={[styles.pointer, start ? styles.pointerStart : styles.pointerStop]} />
    </View>
  );
}

const useStyles = makeStyles(({ colors, elevation }) => ({
  wrap: {
    alignItems: 'center',
    padding: layout.pinShadowRoom,
  },
  head: {
    width: layout.tripPin,
    height: layout.tripPin,
    borderRadius: radius.pill,
    borderWidth: layout.pinRimWidth,
    borderColor: colors.pinRim,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation.card,
  },
  headStop: {
    backgroundColor: colors.primary,
  },
  headStart: {
    backgroundColor: colors.secondaryDark,
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
  pointerStop: {
    borderTopColor: colors.primary,
  },
  pointerStart: {
    borderTopColor: colors.secondaryDark,
  },
}));
