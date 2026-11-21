import { useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppIcon } from '@/components/AppIcon';
import { AppText } from '@/components/AppText';
import { OfflineBanner } from '@/components/OfflineBanner';
import { ScreenHeader } from '@/components/ScreenHeader';
import { EmptyState, ErrorState } from '@/components/StateViews';
import { ThemedStatusBar } from '@/components/ThemedStatusBar';
import { useI18n } from '@/context/I18nContext';
import { usePhotoCredits } from '@/hooks/useDestinations';
import { countCredits } from '@/lib/credits';
import type { CreditGroup } from '@/lib/credits';
import { layout, radius, spacing } from '@/theme';
import { makeStyles, useAppTheme } from '@/theme/ThemeProvider';

/**
 * Photo Credits: every photograph's author and licence, grouped by
 * destination, read live from the photo rows (`destination_images.caption`).
 */
export default function CreditsScreen() {
  const styles = useStyles();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { t } = useI18n();
  const credits = usePhotoCredits();

  const leave = () => (router.canGoBack() ? router.back() : router.replace('/settings'));
  const groups = credits.data ?? [];

  const intro = (
    <View style={styles.intro}>
      <OfflineBanner />
      <View style={styles.introCard}>
        <AppIcon name="camera-outline" size="lg" color="secondaryDark" />
        <AppText variant="body" color="inkSoft" style={styles.flex}>
          {t('credits.intro')}
        </AppText>
      </View>
      {groups.length > 0 ? (
        <AppText variant="label" color="inkSoft">
          {t('credits.count', { count: countCredits(groups) })}
        </AppText>
      ) : null}
    </View>
  );

  return (
    <View style={styles.screen}>
      <ThemedStatusBar />
      <ScreenHeader overline={t('credits.overline')} title={t('credits.title')} onBack={leave} divider />
      {credits.status === 'loading' ? (
        <View style={styles.center} accessibilityLabel={t('credits.loadingA11y')}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : credits.status === 'error' && credits.error ? (
        <ErrorState error={credits.error} onRetry={credits.retry} style={styles.center} />
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(group) => group.destination.id}
          renderItem={({ item }) => <CreditCard group={item} />}
          ListHeaderComponent={intro}
          ListEmptyComponent={<EmptyState icon="camera-off-outline" title={t('credits.empty')} message="" />}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + spacing.xxl }]}
          initialNumToRender={8}
        />
      )}
    </View>
  );
}

function CreditCard({ group }: { group: CreditGroup }) {
  const styles = useStyles();
  const { t } = useI18n();
  return (
    <View style={styles.card} accessible accessibilityLabel={`${group.destination.name}. ${group.credits.map((line) => line.caption).join('. ')}`}>
      <AppText variant="cardTitleSmall">{group.destination.name}</AppText>
      <AppText variant="caption" color="muted">
        {group.destination.province}
      </AppText>
      <View style={styles.lines}>
        {group.credits.map((line) => (
          <View key={line.id} style={styles.line}>
            <AppText variant="overline" color="secondaryDark" style={styles.lineLabel}>
              {line.position === 0 ? t('credits.cover') : t('credits.galleryPhoto', { index: line.position })}
            </AppText>
            <AppText variant="caption" color="inkSoft" style={styles.flex}>
              {line.caption}
            </AppText>
          </View>
        ))}
      </View>
    </View>
  );
}

const useStyles = makeStyles(({ colors, elevation }) => ({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
  },
  intro: {
    gap: spacing.md,
    marginBottom: spacing.xs,
  },
  introCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.secondarySoft,
  },
  card: {
    gap: spacing.xs,
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    ...elevation.card,
  },
  lines: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  lineLabel: {
    width: layout.creditLabelWidth,
  },
}));
