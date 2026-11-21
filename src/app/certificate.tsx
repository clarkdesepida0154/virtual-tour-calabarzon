/**
 * Certificate of Completion (Run 6) — `/certificate?scope=<Province|region>`.
 *
 * Unlocked by visiting every destination of a province (that province's
 * certificate) or of the whole catalogue ("CALABARZON Heritage Explorer").
 * The certificate is a printed document, so it keeps its cream parchment in
 * both themes (the `parchment*` design constants). Holder name: the name
 * typed here (saved on the phone), else the account email's prefix. "Share
 * as image" captures it with react-native-view-shot; everything works
 * offline once the progress has loaded.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import type { ComponentRef } from 'react';
import { KeyboardAvoidingView, ScrollView, View } from 'react-native';
import { TextInput } from 'react-native-paper';

import { AppButton } from '@/components/AppButton';
import { AppIcon } from '@/components/AppIcon';
import { AppText } from '@/components/AppText';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Skeleton } from '@/components/Skeleton';
import { EmptyState, ErrorState } from '@/components/StateViews';
import { ThemedStatusBar } from '@/components/ThemedStatusBar';
import { useI18n } from '@/context/I18nContext';
import { useIdentity } from '@/context/IdentityContext';
import { useToast } from '@/context/ToastContext';
import { useAchievements } from '@/hooks/useAchievements';
import { MAX_HOLDER_NAME, holderName, parseScope } from '@/lib/certificate';
import type { Certificate } from '@/lib/certificate';
import { shareCertificateImage } from '@/lib/certificateShare';
import { tapFeedback } from '@/lib/device';
import { readCertificateName, writeCertificateName } from '@/lib/localPrefs';
import { layout, maxFontScale, radius, spacing, typography } from '@/theme';
import { makeStyles, useAppTheme } from '@/theme/ThemeProvider';

export default function CertificateScreen() {
  const styles = useStyles();
  const { colors } = useAppTheme();
  const { t, date } = useI18n();
  const router = useRouter();
  const identity = useIdentity();
  const { showToast } = useToast();
  const params = useLocalSearchParams<{ scope?: string }>();
  const scope = parseScope(Array.isArray(params.scope) ? params.scope[0] : params.scope) ?? 'region';
  const query = useAchievements();
  const certificateRef = useRef<ComponentRef<typeof View> | null>(null);

  const [name, setName] = useState('');
  const [nameLoaded, setNameLoaded] = useState(false);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    let alive = true;
    readCertificateName().then((saved) => {
      if (!alive) return;
      setName(saved);
      setNameLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const leave = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/progress');
  };

  const changeName = (text: string) => {
    const next = text.slice(0, MAX_HOLDER_NAME);
    setName(next);
    void writeCertificateName(next);
  };

  const certificate: Certificate | undefined = query.data?.certificates.find((entry) => entry.scope === scope);
  const holder = holderName(name, identity.email, t('certificate.defaultHolder'));
  const title = scope === 'region' ? t('certificate.regionTitle') : t('certificate.provinceTitle', { province: scope });
  const line =
    scope === 'region'
      ? t('certificate.regionLine', { count: certificate?.count ?? 0 })
      : t('certificate.provinceLine', { count: certificate?.count ?? 0, province: scope });
  const awarded = date(certificate?.earnedAt);

  const share = async () => {
    if (sharing) return;
    tapFeedback();
    setSharing(true);
    const outcome = await shareCertificateImage(certificateRef, {
      title: t('certificate.shareDialog'),
      message: t('certificate.shareMessage', { title, line }),
    });
    setSharing(false);
    if (outcome === 'unavailable') showToast(t('certificate.shareFailed'));
  };

  let body;
  if (query.status === 'error' && query.error) {
    body = <ErrorState error={query.error} onRetry={query.retry} />;
  } else if (!query.data || !nameLoaded) {
    body = (
      <View accessible accessibilityLabel={t('certificate.loadingA11y')}>
        <Skeleton height={layout.progressRingSize * 3} style={styles.skeleton} />
      </View>
    );
  } else if (!certificate) {
    body = (
      <EmptyState
        icon="certificate-outline"
        title={t('certificate.notEarnedTitle')}
        message={scope === 'region' ? t('certificate.notEarnedRegion') : t('certificate.notEarnedProvince', { province: scope })}
        actionLabel={t('common.back')}
        actionIcon="arrow-left"
        onAction={leave}
      />
    );
  } else {
    body = (
      <>
        {/* The document itself — this view is what gets captured. */}
        <View
          ref={(node) => {
            certificateRef.current = node;
          }}
          collapsable={false}
          style={styles.document}
          accessible
          accessibilityRole="image"
          accessibilityLabel={t('certificate.a11y', { holder, title, date: awarded })}>
          <View style={styles.frame}>
            <Laurel />
            <AppText variant="overline" color="parchmentGold" align="center">
              {t('certificate.heading')}
            </AppText>
            <AppText variant="tagline" color="onParchmentSoft" align="center">
              {t('certificate.presentedTo')}
            </AppText>
            <AppText variant="detailTitle" color="onParchment" align="center" numberOfLines={2} adjustsFontSizeToFit>
              {holder}
            </AppText>
            <GoldRule />
            <AppText variant="body" color="onParchmentSoft" align="center">
              {t('certificate.hasCompleted')}
            </AppText>
            <AppText variant="sectionTitle" color="onParchment" align="center">
              {title}
            </AppText>
            <AppText variant="label" color="onParchmentSoft" align="center">
              {line}
            </AppText>
            <View style={styles.footer}>
              <View style={styles.footerSide}>
                <AppText variant="label" color="parchmentGold">
                  {awarded ? t('certificate.awarded', { date: awarded }) : ''}
                </AppText>
              </View>
              <View style={styles.seal}>
                <AppIcon name="seal-variant" size="lg" color="parchmentGold" />
              </View>
              <View style={styles.footerSide}>
                <AppText variant="caption" color="onParchmentSoft" align="right">
                  {t('certificate.signature')}
                </AppText>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.controls}>
          <TextInput
            mode="outlined"
            label={t('certificate.nameLabel')}
            value={name}
            onChangeText={changeName}
            placeholder={holder}
            maxLength={MAX_HOLDER_NAME}
            autoCapitalize="words"
            accessibilityLabel={t('certificate.nameLabel')}
            outlineColor={colors.outlineStrong}
            activeOutlineColor={colors.primary}
            style={styles.input}
            contentStyle={styles.inputContent}
            maxFontSizeMultiplier={maxFontScale}
          />
          <AppText variant="caption" color="muted">
            {t('certificate.nameHint')}
          </AppText>
          <AppButton label={t('certificate.share')} icon="share-variant-outline" onPress={() => void share()} loading={sharing} />
        </View>
      </>
    );
  }

  return (
    <View style={styles.screen}>
      <ThemedStatusBar />
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <ScreenHeader overline={t('certificate.overline')} title={t('certificate.title')} onBack={leave} />
          <View style={styles.body}>{body}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

/** Compass medallion between two laurel sprigs, drawn from icons (no image assets). */
function Laurel() {
  const styles = useStyles();
  const leaves = [0, 1, 2];
  return (
    <View style={styles.laurel} importantForAccessibility="no-hide-descendants">
      <View style={[styles.sprig, styles.sprigLeft]}>
        {leaves.map((leaf) => (
          <View key={leaf} style={{ transform: [{ rotate: `${-35 + leaf * 30}deg` }] }}>
            <AppIcon name="leaf" size="sm" color="parchmentGold" />
          </View>
        ))}
      </View>
      <View style={styles.medal}>
        <View style={styles.medalInner}>
          <AppIcon name="compass-rose" size="xl" color="parchmentGold" />
        </View>
      </View>
      <View style={[styles.sprig, styles.sprigRight]}>
        {leaves.map((leaf) => (
          <View key={leaf} style={{ transform: [{ scaleX: -1 }, { rotate: `${-35 + leaf * 30}deg` }] }}>
            <AppIcon name="leaf" size="sm" color="parchmentGold" />
          </View>
        ))}
      </View>
    </View>
  );
}

function GoldRule() {
  const styles = useStyles();
  return (
    <View style={styles.rule} importantForAccessibility="no-hide-descendants">
      <View style={styles.ruleLine} />
      <AppIcon name="rhombus-medium" size="xs" color="parchmentGold" />
      <View style={styles.ruleLine} />
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
  scroll: {
    paddingBottom: layout.snackbarOffset,
  },
  body: {
    paddingHorizontal: spacing.lg,
    gap: spacing.xl,
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
  },
  skeleton: {
    borderRadius: radius.md,
  },
  document: {
    padding: layout.certificateFrame,
    borderRadius: radius.sm,
    backgroundColor: colors.parchmentDeep,
    ...elevation.raised,
  },
  frame: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.parchment,
    borderWidth: 2,
    borderColor: colors.parchmentGold,
    borderRadius: radius.sm / 2,
  },
  laurel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  sprig: {
    gap: spacing.xs / 2,
  },
  sprigLeft: {
    alignItems: 'flex-end',
  },
  sprigRight: {
    alignItems: 'flex-start',
  },
  medal: {
    width: layout.certificateMedal,
    height: layout.certificateMedal,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.parchmentGold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  medalInner: {
    width: layout.certificateMedal - spacing.md,
    height: layout.certificateMedal - spacing.md,
    borderRadius: radius.pill,
    borderWidth: layout.hairline,
    borderColor: colors.parchmentGold,
    backgroundColor: colors.parchmentDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  ruleLine: {
    width: layout.ornamentWidth * 1.5,
    height: layout.hairline,
    backgroundColor: colors.parchmentGold,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: layout.hairline,
    borderTopColor: colors.parchmentDeep,
    alignSelf: 'stretch',
  },
  footerSide: {
    flex: 1,
  },
  seal: {
    alignItems: 'center',
  },
  controls: {
    gap: spacing.sm,
  },
  input: {
    backgroundColor: colors.surface,
  },
  inputContent: {
    ...typography.input,
  },
}));
