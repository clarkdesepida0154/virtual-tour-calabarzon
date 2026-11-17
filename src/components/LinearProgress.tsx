import { StyleSheet, View } from 'react-native';
import { ProgressBar } from 'react-native-paper';

import { colors, layout, radius } from '@/theme';

type Props = {
  /** When false the bar is invisible but still reserves its height. */
  visible?: boolean;
  /** `track` shows a tinted rail behind the bar; `bare` shows only the bar. */
  tone?: 'track' | 'bare';
  accessibilityLabel?: string;
};

/**
 * Thin indeterminate progress line.
 *
 * Paper's ProgressBar stretches to 100% of its parent's height on web, so it
 * always lives inside this fixed-height box.
 */
export function LinearProgress({ visible = true, tone = 'bare', accessibilityLabel }: Props) {
  return (
    <View style={styles.box} accessibilityLabel={visible ? accessibilityLabel : undefined}>
      <ProgressBar
        indeterminate
        visible={visible}
        color={colors.primary}
        style={[styles.bar, tone === 'track' && styles.track]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    height: layout.progressBarHeight,
    overflow: 'hidden',
    borderRadius: radius.pill,
  },
  bar: {
    height: layout.progressBarHeight,
    backgroundColor: colors.transparent,
  },
  track: {
    backgroundColor: colors.primarySoft,
  },
});
