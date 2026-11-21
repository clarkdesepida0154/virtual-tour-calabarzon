import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { ScreenHeader } from '@/components/ScreenHeader';
import { DestinationForm } from '@/components/form/DestinationForm';
import { useToast } from '@/context/ToastContext';
import { makeStyles } from '@/theme/ThemeProvider';
import type { Destination } from '@/types/database';
import { useI18n } from '@/context/I18nContext';

/** Add a destination. Opened from the "Add" button on Explore. */
export default function AddDestinationScreen() {
  const { t } = useI18n();
  const styles = useStyles();
  const router = useRouter();
  const { showToast } = useToast();

  const leave = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/explore');
  };

  const handleSaved = (destination: Destination) => {
    showToast(t('form.added', { name: destination.name }));
    // Swap the form for the new destination's page, so Back returns to Explore.
    router.replace({ pathname: '/destination/[id]', params: { id: destination.id } });
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader overline={t('form.addOverline')} title={t('form.addTitle')} onBack={leave} divider />
      <DestinationForm onSaved={handleSaved} onCancel={leave} />
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
}));
