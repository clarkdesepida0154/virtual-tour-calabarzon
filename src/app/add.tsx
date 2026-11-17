import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ScreenHeader } from '@/components/ScreenHeader';
import { DestinationForm } from '@/components/form/DestinationForm';
import { useToast } from '@/context/ToastContext';
import { colors } from '@/theme';
import type { Destination } from '@/types/database';

/** Add a destination. Opened from the "Add" button on Explore. */
export default function AddDestinationScreen() {
  const router = useRouter();
  const { showToast } = useToast();

  const leave = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/explore');
  };

  const handleSaved = (destination: Destination) => {
    showToast(`“${destination.name}” was added.`);
    // Swap the form for the new destination's page, so Back returns to Explore.
    router.replace({ pathname: '/destination/[id]', params: { id: destination.id } });
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader overline="New entry" title="Add a Destination" onBack={leave} divider />
      <DestinationForm onSaved={handleSaved} onCancel={leave} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
