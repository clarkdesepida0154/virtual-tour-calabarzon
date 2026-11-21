import type { StyleProp, ViewStyle } from 'react-native';

import { useFavorites } from '@/context/FavoritesContext';
import { iconSize } from '@/theme';
import { useAppTheme } from '@/theme/ThemeProvider';
import { useI18n } from '@/context/I18nContext';
import { AppIconButton } from '@/components/AppIconButton';

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
  const { colors } = useAppTheme();
  const { t } = useI18n();
  const { isFavorite, toggle } = useFavorites();
  const on = isFavorite(destinationId);

  return (
    <AppIconButton
      icon={on ? 'heart' : 'heart-outline'}
      mode={tone === 'overlay' ? 'contained' : undefined}
      size={iconSize[size]}
      compact={size === 'sm'}
      containerColor={tone === 'overlay' ? colors.surface : undefined}
      iconColor={on ? colors.primary : colors.ink}
      onPress={() => toggle(destinationId, name)}
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      accessibilityLabel={t(on ? 'favorites.remove' : 'favorites.save', { name })}
      style={style}
    />
  );
}
