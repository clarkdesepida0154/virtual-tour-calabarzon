import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ScreenHeader } from '@/components/ScreenHeader';
import { DestinationCardSkeleton } from '@/components/Skeleton';
import { EmptyState, ErrorState } from '@/components/StateViews';
import { DestinationForm } from '@/components/form/DestinationForm';
import { useToast } from '@/context/ToastContext';
import { useDestination } from '@/hooks/useDestinations';
import { colors, spacing } from '@/theme';

export default function EditDestinationScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const router = useRouter();
  const { showToast } = useToast();
  const query = useDestination(id);
  const destination = query.data;

  const leave = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/explore');
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader overline="Editing" title="Edit Destination" onBack={leave} divider />

      {destination ? (
        <DestinationForm
          key={destination.id}
          destination={destination}
          onCancel={leave}
          onSaved={() => {
            showToast('Your changes were saved.');
            leave();
          }}
        />
      ) : query.status === 'error' && query.error ? (
        <ErrorState error={query.error} onRetry={query.retry} style={styles.state} />
      ) : query.status === 'success' ? (
        <EmptyState
          icon="map-marker-off-outline"
          title="Destination not found"
          message="This place is no longer in the collection, so it can’t be edited."
          actionLabel="Back to Explore"
          actionIcon="compass-outline"
          onAction={() => router.replace('/explore')}
          style={styles.state}
        />
      ) : (
        <View style={styles.loading} accessibilityLabel="Loading destination">
          <DestinationCardSkeleton />
          <DestinationCardSkeleton />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  state: {
    marginTop: spacing.xxl,
  },
  loading: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
});
