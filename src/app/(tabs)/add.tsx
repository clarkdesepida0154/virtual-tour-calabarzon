import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ScreenHeader } from '@/components/ScreenHeader';
import { DestinationForm } from '@/components/form/DestinationForm';
import { useToast } from '@/context/ToastContext';
import { colors } from '@/theme';
import type { Destination } from '@/types/database';

export default function AddDestinationScreen() {
  const router = useRouter();
  const { showToast } = useToast();
  // Changing the key remounts the form, which clears it for the next entry.
  const [formKey, setFormKey] = useState(0);

  const handleSaved = (destination: Destination) => {
    setFormKey((key) => key + 1);
    showToast(`“${destination.name}” was added.`);
    router.push({ pathname: '/destination/[id]', params: { id: destination.id } });
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader overline="New entry" title="Add a Destination" divider />
      <DestinationForm key={formKey} onSaved={handleSaved} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
