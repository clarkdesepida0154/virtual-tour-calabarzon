import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps } from 'react';

import { iconSize } from '@/theme';
import { useAppTheme } from '@/theme/ThemeProvider';
import type { ColorToken, IconSizeToken } from '@/theme';

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

type Props = {
  name: IconName;
  size?: IconSizeToken;
  color?: ColorToken;
};

/** Every icon in the app: Material Community Icons, sized and coloured by token. */
export function AppIcon({ name, size = 'md', color = 'ink' }: Props) {
  const { colors } = useAppTheme();
  return <MaterialCommunityIcons name={name} size={iconSize[size]} color={colors[color]} />;
}
