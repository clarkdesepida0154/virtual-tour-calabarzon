import Constants from 'expo-constants';
import type { ReactNode } from 'react';
import { useRouter } from 'expo-router';
import { Linking, Pressable, ScrollView, View } from 'react-native';
import { Switch } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppIcon } from '@/components/AppIcon';
import type { IconName } from '@/components/AppIcon';
import { AppText } from '@/components/AppText';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SegmentedChoice } from '@/components/SegmentedChoice';
import { ThemedStatusBar } from '@/components/ThemedStatusBar';
import { WebDemoNotice } from '@/components/WebDemoNotice';
import { REPOSITORY_URL } from '@/constants/links';
import { useI18n } from '@/context/I18nContext';
import { usePreferences } from '@/context/PreferencesContext';
import { useToast } from '@/context/ToastContext';
import { tapFeedback } from '@/lib/device';
import type { Locale, SpeechRate, ThemePreference } from '@/lib/preferences';

import appJson from '../../app.json';
import { layout, radius, spacing } from '@/theme';
import { makeStyles, useAppTheme } from '@/theme/ThemeProvider';

/**
 * Settings: appearance, language, narration, about and legal. Every change
 * applies at once, app-wide, and is remembered on the device.
 */
export default function SettingsScreen() {
  const styles = useStyles();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { t } = useI18n();
  const { showToast } = useToast();
  const { preferences, update } = usePreferences();
  // The running build's version; the web export has no native manifest, so fall back to app.json.
  const version = Constants.expoConfig?.version ?? appJson.expo.version;

  const leave = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const openRepository = () => {
    Linking.openURL(REPOSITORY_URL).catch(() => showToast(REPOSITORY_URL));
  };

  return (
    <View style={styles.screen}>
      <ThemedStatusBar />
      <ScreenHeader overline={t('settings.overline')} title={t('settings.title')} onBack={leave} divider />
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + spacing.xxl }]}>
        <Section icon="palette-swatch-outline" title={t('settings.appearance.title')} subtitle={t('settings.appearance.subtitle')}>
          <SegmentedChoice<ThemePreference>
            label={t('settings.appearance.title')}
            value={preferences.theme}
            onChange={(theme) => update({ theme })}
            choices={[
              { value: 'system', label: t('settings.appearance.system'), icon: 'cellphone' },
              { value: 'light', label: t('settings.appearance.light'), icon: 'white-balance-sunny' },
              { value: 'dark', label: t('settings.appearance.dark'), icon: 'weather-night' },
            ]}
          />
          {preferences.theme === 'system' ? (
            <AppText variant="caption" color="muted">
              {t('settings.appearance.systemHint')}
            </AppText>
          ) : null}
        </Section>

        <Section icon="translate" title={t('settings.language.title')} subtitle={t('settings.language.subtitle')}>
          <SegmentedChoice<Locale>
            label={t('settings.language.title')}
            value={preferences.locale}
            onChange={(locale) => update({ locale })}
            choices={[
              { value: 'en', label: t('settings.language.english') },
              { value: 'fil', label: t('settings.language.filipino') },
            ]}
          />
          <View style={styles.note}>
            <AppIcon name="information-outline" size="sm" color="muted" />
            <AppText variant="caption" color="muted" style={styles.flex}>
              {t('settings.language.contentNote')}
            </AppText>
          </View>
        </Section>

        <Section icon="headphones" title={t('settings.narration.title')} subtitle={t('settings.narration.subtitle')}>
          <Pressable
            onPress={() => {
              tapFeedback();
              update({ narration: !preferences.narration });
            }}
            accessibilityRole="switch"
            accessibilityState={{ checked: preferences.narration }}
            accessibilityLabel={t('settings.narration.toggle')}
            accessibilityHint={t('settings.narration.toggleHint')}
            style={({ pressed }) => [styles.switchRow, pressed && styles.pressed]}>
            <View style={styles.flex}>
              <AppText variant="bodyStrong">{t('settings.narration.toggle')}</AppText>
              <AppText variant="caption" color="muted">
                {t('settings.narration.toggleHint')}
              </AppText>
            </View>
            {/* Visual only: the whole row is the switch for touch and screen readers. */}
            <View pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
              <Switch value={preferences.narration} color={colors.primary} />
            </View>
          </Pressable>
          {preferences.narration ? (
            <>
              <AppText variant="label" color="inkSoft">
                {t('settings.narration.rate')}
              </AppText>
              <SegmentedChoice<SpeechRate>
                label={t('settings.narration.rate')}
                value={preferences.speechRate}
                onChange={(speechRate) => update({ speechRate })}
                choices={[
                  { value: 'normal', label: t('settings.narration.normal'), icon: 'play-speed' },
                  { value: 'slow', label: t('settings.narration.slow'), icon: 'tortoise' },
                ]}
              />
            </>
          ) : null}
        </Section>

        <Section icon="information-outline" title={t('settings.about.title')}>
          <AppText variant="cardTitleSmall">{t('common.appName')}</AppText>
          <AppText variant="label" color="inkSoft">
            {t('settings.about.version', { version })}
          </AppText>
          <AppText variant="body" color="inkSoft">
            {t('settings.about.project')}
          </AppText>
          <WebDemoNotice />
          <LinkRow
            icon="github"
            label={t('settings.about.repo')}
            hint={t('settings.about.repoHint')}
            trailing="open-in-new"
            onPress={openRepository}
          />
        </Section>

        <Section icon="scale-balance" title={t('settings.legal.title')}>
          <LinkRow
            icon="camera-outline"
            label={t('settings.legal.credits')}
            hint={t('settings.legal.creditsHint')}
            trailing="chevron-right"
            onPress={() => router.push('/credits')}
          />
          <AppText variant="label" color="inkSoft">
            {t('settings.legal.openSource')}
          </AppText>
          <AppText variant="caption" color="muted">
            {t('settings.legal.openSourceBody')}
          </AppText>
        </Section>
      </ScrollView>
    </View>
  );
}

function Section({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: IconName;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const styles = useStyles();
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <View style={styles.sectionIcon}>
          <AppIcon name={icon} size="sm" color="secondaryDark" />
        </View>
        <View style={styles.flex}>
          <AppText variant="subtitle" accessibilityRole="header">
            {title}
          </AppText>
          {subtitle ? (
            <AppText variant="caption" color="inkSoft">
              {subtitle}
            </AppText>
          ) : null}
        </View>
      </View>
      {children}
    </View>
  );
}

function LinkRow({
  icon,
  label,
  hint,
  trailing,
  onPress,
}: {
  icon: IconName;
  label: string;
  hint: string;
  trailing: IconName;
  onPress: () => void;
}) {
  const styles = useStyles();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      style={({ pressed }) => [styles.linkRow, pressed && styles.pressed]}>
      <AppIcon name={icon} size="md" color="primary" />
      <View style={styles.flex}>
        <AppText variant="bodyStrong" color="primary">
          {label}
        </AppText>
        <AppText variant="caption" color="muted">
          {hint}
        </AppText>
      </View>
      <AppIcon name={trailing} size="sm" color="muted" />
    </Pressable>
  );
}

const useStyles = makeStyles(({ colors, elevation }) => ({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  body: {
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
  },
  flex: {
    flex: 1,
  },
  pressed: {
    opacity: layout.pressedOpacity,
  },
  section: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    ...elevation.card,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  sectionIcon: {
    width: layout.iconBadge,
    height: layout.iconBadge,
    borderRadius: radius.pill,
    backgroundColor: colors.secondarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: layout.touchTarget,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: layout.touchTarget,
    paddingVertical: spacing.sm,
  },
}));
