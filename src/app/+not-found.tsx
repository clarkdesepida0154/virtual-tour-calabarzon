import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/StateViews';
import { colors } from '@/theme';

export default function NotFoundScreen() {
  const router = useRouter();

  return (
    <View style={styles.screen}>
      <EmptyState
        icon="compass-off-outline"
        title="Page not found"
        message="That screen doesn’t exist. Let’s get you back to the tour."
        actionLabel="Go to Home"
        actionIcon="home-variant-outline"
        onAction={() => router.replace('/')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
