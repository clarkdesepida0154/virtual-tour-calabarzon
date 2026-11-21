import { useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';

import { ScreenHeader } from '@/components/ScreenHeader';
import { DestinationCardSkeleton } from '@/components/Skeleton';
import { EmptyState, ErrorState } from '@/components/StateViews';
import { DestinationForm } from '@/components/form/DestinationForm';
import { useToast } from '@/context/ToastContext';
import { useDestination } from '@/hooks/useDestinations';
import { spacing } from '@/theme';
import { makeStyles } from '@/theme/ThemeProvider';
import { useI18n } from '@/context/I18nContext';

export default function EditDestinationScreen() {
  const styles = useStyles();
  const { t } = useI18n();
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
      <ScreenHeader overline={t('form.editOverline')} title={t('form.editTitle')} onBack={leave} divider />

      {destination ? (
        <DestinationForm
          key={destination.id}
          destination={destination}
          onCancel={leave}
          onSaved={() => {
            showToast(t('form.savedChanges'));
            leave();
          }}
        />
      ) : query.status === 'error' && query.error ? (
        <ErrorState error={query.error} onRetry={query.retry} style={styles.state} />
      ) : query.status === 'success' ? (
        <EmptyState
          icon="map-marker-off-outline"
          title={t('details.notFound.title')}
          message={t('form.editNotFound')}
          actionLabel={t('details.notFound.action')}
          actionIcon="compass-outline"
          onAction={() => router.replace('/explore')}
          style={styles.state}
        />
      ) : (
        <View style={styles.loading} accessibilityLabel={t('form.loadingA11y')}>
          <DestinationCardSkeleton />
          <DestinationCardSkeleton />
        </View>
      )}
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
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
}));
