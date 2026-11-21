import type { ComponentProps } from 'react';
import { IconButton } from 'react-native-paper';

import { layout, radius } from '@/theme';

type Props = ComponentProps<typeof IconButton> & {
  /** 44 dp instead of 48 dp — for buttons laid over list-card photos. */
  compact?: boolean;
};

/**
 * Paper's IconButton with an accessible box: Paper sizes the button to the
 * glyph + 16 dp (38 dp for our standard icon), below the 44–48 dp minimum.
 * This keeps the glyph size but makes the visible, focusable box 48 dp
 * (44 dp when `compact`), always round.
 */
export function AppIconButton({ compact = false, style, ...props }: Props) {
  const box = compact ? layout.touchTargetCompact : layout.touchTarget;
  return <IconButton {...props} style={[{ width: box, height: box, borderRadius: radius.pill }, style]} />;
}
