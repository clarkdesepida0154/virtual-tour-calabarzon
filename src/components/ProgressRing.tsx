import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { layout } from '@/theme';
import { makeStyles, useAppTheme } from '@/theme/ThemeProvider';
import type { ColorToken } from '@/theme';

type Props = {
  /** 0–1. */
  progress: number;
  size?: number;
  stroke?: number;
  color?: ColorToken;
  trackColor?: ColorToken;
  /** Shown in the middle of the ring. */
  children?: ReactNode;
  accessibilityLabel: string;
};

/** A circular progress meter (react-native-svg, included in Expo Go). */
export function ProgressRing({
  progress,
  size = layout.progressRingSize,
  stroke = layout.progressRingStroke,
  color = 'primary',
  trackColor = 'surfaceMuted',
  children,
  accessibilityLabel,
}: Props) {
  const styles = useStyles();
  const { colors } = useAppTheme();
  const clamped = Math.min(1, Math.max(0, progress));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  return (
    <View
      style={{ width: size, height: size }}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}>
      <Svg width={size} height={size}>
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={colors[trackColor]}
          strokeWidth={stroke}
          fill="none"
        />
        {clamped > 0 ? (
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke={colors[color]}
            strokeWidth={stroke}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={circumference * (1 - clamped)}
            // Start at 12 o'clock and run clockwise.
            transform={`rotate(-90 ${center} ${center})`}
          />
        ) : null}
      </Svg>
      <View style={styles.center} pointerEvents="none">
        {children}
      </View>
    </View>
  );
}

const useStyles = makeStyles(() => ({
  center: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
