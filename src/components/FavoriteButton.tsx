import { IconButton } from 'react-native-paper';
import type { StyleProp, ViewStyle } from 'react-native';

import { useFavorites } from '@/context/FavoritesContext';
import { colors, iconSize } from '@/theme';

type Props = {
  destinationId: string;
  name: string;
  /** `overlay` sits on a photo (white disc), `plain` sits on cream or white. */
  tone?: 'overlay' | 'plain';
  size?: 'sm' | 'md';
  style?: StyleProp<ViewStyle>;
};

/** Heart toggle. Filled terracotta when saved; shared state, so every heart agrees. */
export function FavoriteButton({ destinationId, name, tone = 'overlay', size = 'md', style }: Props) {
  const { isFavorite, toggle } = useFavorites();
  const on = isFavorite(destinationId);

  return (
    <IconButton
      icon={on ? 'heart' : 'heart-outline'}
      mode={tone === 'overlay' ? 'contained' : undefined}
      size={iconSize[size]}
      containerColor={tone === 'overlay' ? colors.surface : undefined}
      iconColor={on ? colors.primary : colors.ink}
      onPress={() => toggle(destinationId, name)}
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      accessibilityLabel={on ? `Remove ${name} from favorites` : `Save ${name} to favorites`}
      style={style}
    />
  );
}
