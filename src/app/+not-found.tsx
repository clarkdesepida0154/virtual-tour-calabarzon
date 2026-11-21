import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { EmptyState } from '@/components/StateViews';
import { makeStyles } from '@/theme/ThemeProvider';
import { useI18n } from '@/context/I18nContext';

export default function NotFoundScreen() {
  const { t } = useI18n();
  const styles = useStyles();
  const router = useRouter();

  return (
    <View style={styles.screen}>
      <EmptyState
        icon="compass-off-outline"
        title={t('notFound.title')}
        message={t('notFound.message')}
        actionLabel={t('notFound.action')}
        actionIcon="home-variant-outline"
        onAction={() => router.replace('/')}
      />
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  screen: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
}));
