import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps } from 'react';

import { colors, iconSize } from '@/theme';
import type { ColorToken, IconSizeToken } from '@/theme';

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

type Props = {
  name: IconName;
  size?: IconSizeToken;
  color?: ColorToken;
};

/** Every icon in the app: Material Community Icons, sized and coloured by token. */
export function AppIcon({ name, size = 'md', color = 'ink' }: Props) {
  return <MaterialCommunityIcons name={name} size={iconSize[size]} color={colors[color]} />;
}
