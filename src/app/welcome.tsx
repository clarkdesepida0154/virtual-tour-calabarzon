import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '@/components/AppButton';
import { AppText } from '@/components/AppText';
import { ThemedStatusBar } from '@/components/ThemedStatusBar';
import { useIdentity } from '@/context/IdentityContext';
import { layout, motion, radius, spacing } from '@/theme';
import { makeStyles, useAppTheme } from '@/theme/ThemeProvider';
import { useI18n } from '@/context/I18nContext';

/** Bundled so Welcome looks right even offline. Same file as the dataset's Taal cover. */
const WELCOME_PHOTO = require('../../assets/images/welcome.jpg');
const WELCOME_PHOTO_CREDIT = 'Photo: ImaheNiNiño1989, CC BY-SA 4.0, via Wikimedia Commons';
const EMBLEM = require('../../assets/images/splash-icon.png');

/** First screen without a session: sign in, create an account, or continue as a guest. */
export default function WelcomeScreen() {
  const styles = useStyles();
  const { colors } = useAppTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { continueAsGuest } = useIdentity();
  const { t } = useI18n();
  const [isEntering, setIsEntering] = useState(false);

  const photoHeight = Math.max(layout.detailCoverMinHeight, height * layout.welcomePhotoRatio);

  const enterAsGuest = async () => {
    setIsEntering(true);
    // The root stack switches to the app as soon as the choice is saved.
    await continueAsGuest();
  };

  return (
    <View style={styles.screen}>
      <ThemedStatusBar overDark />
      <ScrollView
        bounces={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}>
        <View style={{ height: photoHeight }}>
          <Image
            source={WELCOME_PHOTO}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={motion.normal}
            accessibilityLabel={t('welcome.photoA11y')}
          />
          <LinearGradient
            colors={[colors.photoShadeSoft, colors.photoShadeNone]}
            style={[styles.topFade, { height: insets.top + layout.coverFadeHeight }]}
          />
          <LinearGradient
            colors={[colors.photoShadeNone, colors.background]}
            locations={[0.45, 1]}
            style={StyleSheet.absoluteFill}
          />
        </View>

        <View style={styles.body}>
          <View style={styles.emblem}>
            <Image source={EMBLEM} style={styles.emblemImage} contentFit="contain" accessible={false} />
          </View>

          <AppText variant="overline" color="secondaryDark" align="center">
            {t('common.region')}
          </AppText>
          <AppText variant="hero" align="center" accessibilityRole="header">
            {t('common.appName')}
          </AppText>
          <View style={styles.rule} />
          <AppText variant="tagline" color="inkSoft" align="center" style={styles.tagline}>
            {t('welcome.tagline')}
          </AppText>

          <View style={styles.actions}>
            <AppButton
              label={t('welcome.createAccount')}
              icon="account-plus-outline"
              onPress={() => router.push('/sign-up')}
              disabled={isEntering}
            />
            <AppButton
              label={t('welcome.signIn')}
              icon="login"
              variant="secondary"
              onPress={() => router.push('/sign-in')}
              disabled={isEntering}
            />
            <AppButton
              label={t('welcome.continueAsGuest')}
              icon="arrow-right"
              variant="text"
              onPress={enterAsGuest}
              loading={isEntering}
              accessibilityHint={t('welcome.guestHint')}
            />
          </View>

          <AppText variant="caption" color="muted" align="center">
            {t('welcome.guestNote')}
          </AppText>

          <AppText variant="caption" color="muted" align="center" style={styles.credit}>
            {t('welcome.cover')} {WELCOME_PHOTO_CREDIT}
          </AppText>
        </View>
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles(({ colors, elevation }) => ({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topFade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  body: {
    marginTop: -layout.emblem,
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
    alignItems: 'stretch',
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
  },
  emblem: {
    width: layout.emblem,
    height: layout.emblem,
    borderRadius: radius.pill,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    borderWidth: 2,
    borderColor: colors.secondary,
    ...elevation.raised,
  },
  emblemImage: {
    width: layout.emblem - spacing.xl,
    height: layout.emblem - spacing.xl,
  },
  rule: {
    width: layout.ornamentWidth,
    height: layout.ornamentHeight,
    borderRadius: radius.pill,
    backgroundColor: colors.secondary,
    alignSelf: 'center',
  },
  tagline: {
    paddingHorizontal: spacing.sm,
  },
  actions: {
    gap: spacing.md,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  credit: {
    marginTop: spacing.lg,
  },
}));
