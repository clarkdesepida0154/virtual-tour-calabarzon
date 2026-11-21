/**
 * Virtual Tour — a guided, full-screen "exhibit" of one destination:
 *
 *   Intro → Gallery → History → Cultural Significance → Completion
 *
 * Steps without content (for example a destination added in the app with no
 * history text) are skipped. The completion step marks the destination as
 * visited for the current user and leads into the quiz.
 */
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, FlatList, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInLeft, FadeInRight } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '@/components/AppButton';
import { AppIcon } from '@/components/AppIcon';
import { AppIconButton } from '@/components/AppIconButton';
import { AppText } from '@/components/AppText';
import { BestScoreBadge, PageDots, VisitedBadge } from '@/components/Badges';
import { CoverImage } from '@/components/CoverImage';
import { NarrationButton } from '@/components/NarrationButton';
import { EmptyState, ErrorState } from '@/components/StateViews';
import { CategoryTag } from '@/components/Tag';
import { ThemedStatusBar } from '@/components/ThemedStatusBar';
import { useDataSync } from '@/context/DataSyncContext';
import { useIdentity } from '@/context/IdentityContext';
import { useToast } from '@/context/ToastContext';
import { useDestination, useDestinationImages } from '@/hooks/useDestinations';
import { useDestinationProgress } from '@/hooks/useProgress';
import { useAchievementsCheck } from '@/context/AchievementsContext';
import { useShowingSavedData } from '@/lib/appCache';
import { openDirections, openStreetView, successFeedback, tapFeedback } from '@/lib/device';
import { toAppError } from '@/lib/errors';
import { formatPlace, splitLead } from '@/lib/format';
import { hasCoordinates } from '@/lib/mapRegion';
import { progressRepository } from '@/repositories';
import { iconSize, layout, motion, radius, spacing } from '@/theme';
import { makeStyles, useAppTheme } from '@/theme/ThemeProvider';
import type { Destination, DestinationImage } from '@/types/database';
import { useI18n } from '@/context/I18nContext';

type Step = 'intro' | 'gallery' | 'history' | 'culture' | 'complete';

/** Steps shown on a dark "gallery wall"; the others sit on warm cream paper. */
const DARK_STEPS: readonly Step[] = ['intro', 'gallery'];

/** A photo to show: the gallery rows, or just the cover when there are none. */
type Plate = { key: string; uri: string; caption: string | null };

export default function VirtualTourScreen() {
  const styles = useStyles();
  const { colors } = useAppTheme();
  const { t } = useI18n();
  const params = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const query = useDestination(id);
  const images = useDestinationImages(id);
  const progress = useDestinationProgress(id);

  const [stepIndex, setStepIndex] = useState(0);
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');

  const destination = query.data;
  const plates = buildPlates(destination, images.data);
  const steps = buildSteps(destination, plates);
  const step = steps[Math.min(stepIndex, steps.length - 1)];
  const isDark = DARK_STEPS.includes(step);

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace({ pathname: '/destination/[id]', params: { id } });
  };

  const go = (delta: 1 | -1) => {
    setDirection(delta === 1 ? 'forward' : 'back');
    setStepIndex((current) => Math.max(0, Math.min(steps.length - 1, current + delta)));
  };

  // Android back button: step back through the tour before leaving it.
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (stepIndex === 0) return false;
      setDirection('back');
      setStepIndex((current) => Math.max(0, current - 1));
      return true;
    });
    return () => subscription.remove();
  }, [stepIndex]);

  // --- Loading / error / not found ----------------------------------------
  if (!destination) {
    const failed = query.status === 'error' && query.error;
    const missing = query.status === 'success';
    return (
      <View style={[styles.screen, failed || missing ? styles.paper : styles.wall]}>
        <ThemedStatusBar overDark={!(failed || missing)} />
        <CloseButton onPress={close} top={insets.top} dark={!(failed || missing)} />
        {failed ? (
          <ErrorState error={query.error!} onRetry={query.retry} style={styles.centered} />
        ) : missing ? (
          <EmptyState
            icon="map-marker-off-outline"
            title={t('tour.notFound.title')}
            message={t('tour.notFound.message')}
            actionLabel={t('common.close')}
            actionIcon="close"
            onAction={close}
            style={styles.centered}
          />
        ) : (
          <View style={styles.loading} accessibilityLabel={t('tour.preparingA11y')}>
            <ActivityIndicator color={colors.secondary} size="large" />
            <AppText variant="tagline" color="onExhibitSoft">
              {t('tour.preparing')}
            </AppText>
          </View>
        )}
      </View>
    );
  }

  const entering = (direction === 'forward' ? FadeInRight : FadeInLeft).duration(motion.step);
  const nextLabel =
    step === 'intro'
      ? t('tour.intro.begin')
      : steps[stepIndex + 1] === 'complete'
        ? t('tour.finish')
        : t('common.continue');

  return (
    <View style={[styles.screen, isDark ? styles.wall : styles.paper]}>
      <ThemedStatusBar overDark={isDark} />

      <Animated.View key={step} entering={entering} style={styles.flex}>
        {step === 'intro' ? (
          <IntroStep destination={destination} cover={plates[0]} visited={progress.data?.visited ?? false} />
        ) : step === 'gallery' ? (
          <GalleryStep plates={plates} topInset={insets.top} destination={destination} />
        ) : step === 'history' ? (
          <ChapterStep
            numeral="I"
            title={t('details.history')}
            icon="book-open-page-variant-outline"
            body={destination.history ?? ''}
            plate={plates[1] ?? plates[0]}
            topInset={insets.top}
          />
        ) : step === 'culture' ? (
          <ChapterStep
            numeral={steps.includes('history') ? 'II' : 'I'}
            title={t('details.culture')}
            icon="drama-masks"
            body={destination.cultural_significance ?? ''}
            plate={plates[2] ?? plates[1] ?? plates[0]}
            topInset={insets.top}
          />
        ) : (
          <CompletionStep
            destination={destination}
            visited={progress.data?.visited ?? false}
            visitedAt={progress.data?.visitedAt ?? null}
            best={progress.data?.best ?? null}
            topInset={insets.top}
            bottomInset={insets.bottom}
            onClose={close}
          />
        )}
      </Animated.View>

      {/* Top: step indicator + close */}
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]} pointerEvents="box-none">
        <View
          style={styles.segments}
          accessible
          accessibilityLabel={t('tour.stepOf', { index: stepIndex + 1, count: steps.length })}>
          {steps.map((name, index) => (
            <View
              key={name}
              style={[
                styles.segment,
                {
                  backgroundColor:
                    index <= stepIndex
                      ? colors[isDark ? 'secondary' : 'primary']
                      : colors[isDark ? 'onExhibitFaint' : 'outline'],
                },
              ]}
            />
          ))}
        </View>
        <CloseButton onPress={close} dark={isDark} />
      </View>

      {/* Bottom: back / next (the completion step has its own actions) */}
      {step !== 'complete' ? (
        <View
          style={[
            styles.bottomBar,
            isDark ? styles.bottomBarDark : styles.bottomBarLight,
            { paddingBottom: insets.bottom + spacing.md },
          ]}>
          {stepIndex > 0 ? (
            <AppIconButton
              icon="arrow-left"
              mode="contained"
              size={iconSize.md}
              containerColor={isDark ? colors.glass : colors.surface}
              iconColor={isDark ? colors.onPhoto : colors.ink}
              onPress={() => go(-1)}
              accessibilityLabel={t('tour.previousStep')}
              style={!isDark && styles.outlined}
            />
          ) : null}
          <AppButton
            label={nextLabel}
            icon={step === 'intro' ? 'walk' : 'arrow-right'}
            onPress={() => go(1)}
            style={styles.flex}
          />
        </View>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

function IntroStep({
  destination,
  cover,
  visited,
}: {
  destination: Destination;
  cover: Plate | undefined;
  visited: boolean;
}) {
  const styles = useStyles();
  const { colors } = useAppTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.flex}>
      <CoverImage
        uri={cover?.uri ?? destination.cover_image_url}
        label={t('common.photoOf', { name: destination.name })}
        fallbackIconSize="xxl"
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={[colors.photoShadeSoft, colors.photoShadeNone, colors.photoShadeStrong, colors.exhibit]}
        locations={[0, 0.25, 0.68, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={[
          styles.introText,
          { paddingBottom: insets.bottom + layout.actionBarHeight + spacing.xl },
        ]}>
        <Animated.View entering={FadeInDown.delay(motion.fast).duration(motion.step * 2)} style={styles.introStack}>
          <View style={styles.introOverline}>
            <View style={styles.introRule} />
            <AppText variant="overline" color="secondary">
              {t('tour.intro.overline')}
            </AppText>
          </View>
          <AppText variant="exhibitTitle" color="onPhoto" accessibilityRole="header">
            {destination.name}
          </AppText>
          <View style={styles.introMeta}>
            <CategoryTag category={destination.category} tone="overlay" />
            {visited ? <VisitedBadge /> : null}
          </View>
          <View style={styles.introPlace}>
            <AppIcon name="map-marker-outline" size="sm" color="secondary" />
            <AppText variant="subtitle" color="onPhotoMuted">
              {formatPlace(destination)}
            </AppText>
          </View>
          <AppText variant="body" color="onExhibitSoft" numberOfLines={5}>
            {destination.description}
          </AppText>
          {cover?.caption ? <Credit caption={cover.caption} dark /> : null}
        </Animated.View>
      </View>
    </View>
  );
}

function GalleryStep({
  plates,
  topInset,
  destination,
}: {
  plates: Plate[];
  topInset: number;
  destination: Destination;
}) {
  const styles = useStyles();
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<Plate> | null>(null);
  const [index, setIndex] = useState(0);
  const current = plates[index];

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(event.nativeEvent.contentOffset.x / Math.max(1, width));
    if (next !== index && next >= 0 && next < plates.length) setIndex(next);
  };

  const showPlate = (next: number) => {
    const clamped = Math.max(0, Math.min(plates.length - 1, next));
    listRef.current?.scrollToOffset({ offset: clamped * width, animated: true });
    setIndex(clamped);
  };

  // The photo fills whatever height is left between the heading and the
  // caption block; the pages need that height as a number.
  const [frameHeight, setFrameHeight] = useState(Math.round(height * 0.5));

  return (
    <View style={[styles.flex, { paddingTop: topInset + layout.topBarHeight }]}>
      <View style={styles.galleryHeader}>
        <AppText variant="overline" color="secondary">
          {t('tour.gallery.overline')}
        </AppText>
        <AppText variant="chapterTitle" color="onPhoto" accessibilityRole="header">
          {t('tour.gallery.title')}
        </AppText>
      </View>

      <View style={styles.flex} onLayout={(event) => setFrameHeight(event.nativeEvent.layout.height)}>
        <FlatList
          ref={(instance) => {
            listRef.current = instance;
          }}
          data={plates}
          keyExtractor={(plate) => plate.key}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          getItemLayout={(_, itemIndex) => ({ length: width, offset: width * itemIndex, index: itemIndex })}
          renderItem={({ item, index: itemIndex }) => (
            <View style={{ width, height: frameHeight }}>
              <CoverImage
                uri={item.uri}
                label={t('tour.gallery.photoOf', { index: itemIndex + 1, count: plates.length })}
                fallbackIconSize="xxl"
                style={[StyleSheet.absoluteFill, styles.plateFrame]}
                fit="contain"
              />
            </View>
          )}
        />
        {plates.length > 1 ? (
          <>
            {index > 0 ? (
              <AppIconButton
                icon="chevron-left"
                mode="contained"
                size={iconSize.md}
                containerColor={colors.glass}
                iconColor={colors.onPhoto}
                onPress={() => showPlate(index - 1)}
                accessibilityLabel={t('tour.gallery.previousPhoto')}
                style={[styles.plateArrow, styles.plateArrowLeft]}
              />
            ) : null}
            {index < plates.length - 1 ? (
              <AppIconButton
                icon="chevron-right"
                mode="contained"
                size={iconSize.md}
                containerColor={colors.glass}
                iconColor={colors.onPhoto}
                onPress={() => showPlate(index + 1)}
                accessibilityLabel={t('tour.gallery.nextPhoto')}
                style={[styles.plateArrow, styles.plateArrowRight]}
              />
            ) : null}
          </>
        ) : null}
      </View>

      <View style={[styles.plateFooter, { paddingBottom: insets.bottom + layout.actionBarHeight + spacing.lg }]}>
        <PageDots count={plates.length} index={index} />
        <AppText variant="label" color="onExhibitSoft">
          {t('tour.gallery.plate', { index: index + 1, count: plates.length })}
        </AppText>
        {current?.caption ? <Credit caption={current.caption} dark /> : null}
        <StreetViewCard destination={destination} />
      </View>
    </View>
  );
}

/**
 * Run 6: "View in 360°" — a card on the gallery wall that opens Google
 * Street View at the destination. Hidden offline and without coordinates.
 * (It lives on the Gallery step instead of a step of its own, so the tour's
 * step sequence — and the flows built on it — stay exactly as they were.)
 */
function StreetViewCard({ destination }: { destination: Destination }) {
  const styles = useStyles();
  const { t } = useI18n();
  const { showToast } = useToast();
  const offline = useShowingSavedData();
  if (offline || !hasCoordinates(destination)) return null;

  const open = async () => {
    tapFeedback();
    if (!(await openStreetView(destination))) showToast(t('streetView.failed'));
  };

  return (
    <Pressable
      onPress={() => void open()}
      accessibilityRole="button"
      accessibilityLabel={t('streetView.actionA11y', { name: destination.name })}
      accessibilityHint={t('streetView.hint')}
      style={({ pressed }) => [styles.panoCard, pressed && styles.pressed]}>
      <View style={styles.panoIcon}>
        <AppIcon name="rotate-3d-variant" size="md" color="secondary" />
      </View>
      <View style={styles.flex}>
        <AppText variant="overline" color="secondary">
          {t('streetView.tourOverline')}
        </AppText>
        <AppText variant="subtitle" color="onPhoto">
          {t('streetView.action')}
        </AppText>
        <AppText variant="caption" color="onExhibitSoft">
          {t('streetView.tourBody')}
        </AppText>
      </View>
      <AppIcon name="open-in-new" size="sm" color="onPhoto" />
    </Pressable>
  );
}

function ChapterStep({
  numeral,
  title,
  icon,
  body,
  plate,
  topInset,
}: {
  numeral: string;
  title: string;
  icon: 'book-open-page-variant-outline' | 'drama-masks';
  body: string;
  plate: Plate | undefined;
  topInset: number;
}) {
  const styles = useStyles();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { lead, rest } = splitLead(body);
  const paragraphs = rest.split(/\n{2,}/).filter(Boolean);

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[
        styles.chapter,
        {
          paddingTop: topInset + layout.topBarHeight,
          paddingBottom: insets.bottom + layout.actionBarHeight + spacing.xxl,
        },
      ]}>
      <View style={styles.chapterHeading}>
        <View style={styles.chapterIcon}>
          <AppIcon name={icon} size="md" color="secondaryDark" />
        </View>
        <AppText variant="overline" color="secondaryDark">
          {t(numeral === 'I' ? 'tour.chapter.one' : 'tour.chapter.two')}
        </AppText>
        <AppText variant="chapterTitle" accessibilityRole="header" align="center">
          {title}
        </AppText>
        <View style={styles.ornament}>
          <View style={styles.ornamentLine} />
          <AppIcon name="rhombus-medium" size="xs" color="secondary" />
          <View style={styles.ornamentLine} />
        </View>
        {/* Museum audio guide: reads this chapter aloud (hidden without a voice). */}
        <NarrationButton text={`${title}. ${body}`} />
      </View>

      {plate ? (
        <View style={styles.chapterPlate}>
          <CoverImage uri={plate.uri} label={t('tour.chapter.photoFor', { title })} style={styles.chapterPhoto} />
          {plate.caption ? <Credit caption={plate.caption} /> : null}
        </View>
      ) : null}

      {lead ? (
        <AppText variant="lead" color="ink" style={styles.leadText}>
          {lead}
        </AppText>
      ) : null}
      {paragraphs.map((paragraph, index) => (
        <AppText key={index} variant="reading" color="inkSoft">
          {paragraph}
        </AppText>
      ))}
    </ScrollView>
  );
}

function CompletionStep({
  destination,
  visited,
  visitedAt,
  best,
  topInset,
  bottomInset,
  onClose,
}: {
  destination: Destination;
  visited: boolean;
  visitedAt: string | null;
  best: { score: number; total: number } | null;
  topInset: number;
  bottomInset: number;
  onClose: () => void;
}) {
  const styles = useStyles();
  const router = useRouter();
  const { t, errorMessage, date } = useI18n();
  const { userKey } = useIdentity();
  const { notifyChanged } = useDataSync();
  const { showToast } = useToast();
  const { checkAchievements } = useAchievementsCheck();
  const [saving, setSaving] = useState(false);
  // Shown straight away after a successful save, before the refetch lands.
  const [justVisitedAt, setJustVisitedAt] = useState<string | null>(null);

  const isVisited = visited || justVisitedAt !== null;
  const dateLabel = date(visitedAt ?? justVisitedAt);

  const markVisited = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const row = await progressRepository.markVisited(userKey, destination.id);
      setJustVisitedAt(row.completed_at ?? new Date().toISOString());
      successFeedback();
      notifyChanged();
      checkAchievements();
    } catch (cause) {
      showToast(errorMessage(toAppError(cause, 'markVisited')));
    } finally {
      setSaving(false);
    }
  };

  const takeQuiz = () =>
    router.replace({ pathname: '/destination/[id]/quiz', params: { id: destination.id } });

  const getDirections = async () => {
    if (!(await openDirections(destination))) showToast(t('details.directionsFailed'));
  };

  return (
    <ScrollView
      contentContainerStyle={[
        styles.complete,
        { paddingTop: topInset + layout.topBarHeight + spacing.xl, paddingBottom: bottomInset + spacing.xxl },
      ]}
      showsVerticalScrollIndicator={false}>
      <View style={[styles.emblem, isVisited && styles.emblemVisited]}>
        <AppIcon
          name={isVisited ? 'check-decagram' : 'seal-variant'}
          size="xxl"
          color={isVisited ? 'success' : 'secondaryDark'}
        />
      </View>

      <AppText variant="overline" color="secondaryDark" align="center">
        {t('tour.complete.overline')}
      </AppText>
      <AppText variant="chapterTitle" align="center" accessibilityRole="header">
        {t('tour.complete.title', { name: destination.name })}
      </AppText>
      <View style={styles.rule} />

      {isVisited ? (
        <Animated.View entering={FadeIn.duration(motion.step)} style={styles.visitedCard}>
          <AppIcon name="map-marker-check" size="lg" color="success" />
          <View style={styles.flex}>
            <AppText variant="subtitle" color="success">
              {t('tour.complete.visited')}
            </AppText>
            {dateLabel ? (
              <AppText variant="caption" color="inkSoft">
                {t('tour.complete.visitedOn', { date: dateLabel })}
              </AppText>
            ) : null}
          </View>
        </Animated.View>
      ) : (
        <AppText variant="bodyLarge" color="inkSoft" align="center">
          {t('tour.complete.record')}
        </AppText>
      )}

      {best ? (
        <View style={styles.centerRow}>
          <BestScoreBadge score={best.score} total={best.total} />
        </View>
      ) : null}

      <View style={styles.completeActions}>
        {!isVisited ? (
          <AppButton label={t('tour.complete.markVisited')} icon="map-marker-check-outline" onPress={markVisited} loading={saving} />
        ) : null}
        <AppButton
          label={t(best ? 'tour.complete.retakeQuiz' : 'tour.complete.takeQuiz')}
          icon="help-circle-outline"
          variant={isVisited ? 'primary' : 'secondary'}
          onPress={takeQuiz}
          disabled={saving}
          accessibilityHint={t('tour.complete.quizHint')}
        />
        <AppButton label={t('tour.complete.backToDestination')} variant="text" onPress={onClose} disabled={saving} />
      </View>

      {hasCoordinates(destination) ? (
        <View style={styles.visitCard}>
          <AppIcon name="directions" size="lg" color="primary" />
          <View style={styles.flex}>
            <AppText variant="subtitle">{t('tour.complete.visitTitle')}</AppText>
            <AppText variant="caption" color="inkSoft">
              {t('tour.complete.visitBody')}
            </AppText>
          </View>
        </View>
      ) : null}
      {hasCoordinates(destination) ? (
        <AppButton
          label={t('details.getDirections')}
          icon="directions"
          variant="secondary"
          onPress={() => void getDirections()}
          accessibilityHint={t('details.directionsHint')}
        />
      ) : null}
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Small pieces
// ---------------------------------------------------------------------------

function CloseButton({ onPress, dark, top }: { onPress: () => void; dark: boolean; top?: number }) {
  const styles = useStyles();
  const { t } = useI18n();
  const { colors } = useAppTheme();
  return (
    <AppIconButton
      icon="close"
      mode="contained"
      size={iconSize.md}
      containerColor={dark ? colors.glass : colors.surface}
      iconColor={dark ? colors.onPhoto : colors.ink}
      onPress={onPress}
      accessibilityLabel={t('tour.closeA11y')}
      style={top !== undefined ? [styles.floatingClose, { top: top + spacing.sm }] : undefined}
    />
  );
}

/** The photo credit required by the licence, as a quiet caption. */
function Credit({ caption, dark = false }: { caption: string; dark?: boolean }) {
  const styles = useStyles();
  return (
    <View style={styles.credit}>
      <AppIcon name="camera-outline" size="xs" color={dark ? 'onExhibitSoft' : 'muted'} />
      <AppText variant="caption" color={dark ? 'onExhibitSoft' : 'muted'} style={styles.flex}>
        {caption}
      </AppText>
    </View>
  );
}

function buildPlates(destination: Destination | null | undefined, rows: DestinationImage[] | undefined): Plate[] {
  const plates: Plate[] = (rows ?? []).map((row) => ({ key: row.id, uri: row.image_url, caption: row.caption }));
  if (plates.length === 0 && destination?.cover_image_url) {
    plates.push({ key: 'cover', uri: destination.cover_image_url, caption: null });
  }
  return plates;
}

function buildSteps(destination: Destination | null | undefined, plates: Plate[]): Step[] {
  const steps: Step[] = ['intro'];
  if (plates.length > 0) steps.push('gallery');
  if (destination?.history?.trim()) steps.push('history');
  if (destination?.cultural_significance?.trim()) steps.push('culture');
  steps.push('complete');
  return steps;
}

const useStyles = makeStyles(({ colors }) => ({
  screen: {
    flex: 1,
  },
  wall: {
    backgroundColor: colors.exhibit,
  },
  paper: {
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  centered: {
    marginTop: spacing.huge * 2,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  floatingClose: {
    position: 'absolute',
    right: spacing.sm,
    zIndex: 2,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingLeft: spacing.xl,
    paddingRight: spacing.sm,
  },
  segments: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing.xs,
  },
  segment: {
    flex: 1,
    height: layout.stepSegmentHeight,
    borderRadius: radius.pill,
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  bottomBarDark: {
    backgroundColor: colors.transparent,
  },
  bottomBarLight: {
    backgroundColor: colors.background,
    borderTopWidth: layout.hairline,
    borderTopColor: colors.outline,
  },
  outlined: {
    borderWidth: layout.hairline,
    borderColor: colors.outlineStrong,
  },
  // Intro
  introText: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.xl,
  },
  introStack: {
    gap: spacing.md,
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
  },
  introOverline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  introRule: {
    width: layout.ornamentWidth,
    height: layout.ornamentHeight,
    borderRadius: radius.pill,
    backgroundColor: colors.secondary,
  },
  introMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  introPlace: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  // Gallery
  galleryHeader: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    gap: spacing.xs,
  },
  plateFrame: {
    backgroundColor: colors.exhibit,
  },
  plateArrow: {
    position: 'absolute',
    top: '50%',
    marginTop: -spacing.xl,
  },
  plateArrowLeft: {
    left: spacing.xs,
  },
  plateArrowRight: {
    right: spacing.xs,
  },
  plateFooter: {
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.xl,
  },
  credit: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    alignSelf: 'stretch',
  },
  pressed: {
    opacity: layout.pressedOpacity,
  },
  panoCard: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: layout.touchTarget,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.glass,
    borderWidth: layout.hairline,
    borderColor: colors.secondary,
  },
  panoIcon: {
    width: layout.iconBadge,
    height: layout.iconBadge,
    borderRadius: radius.pill,
    borderWidth: layout.hairline,
    borderColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Chapters
  chapter: {
    paddingHorizontal: spacing.xl,
    gap: spacing.lg,
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
  },
  chapterHeading: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.lg,
  },
  chapterIcon: {
    width: layout.iconBadge + spacing.sm,
    height: layout.iconBadge + spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.secondarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  ornament: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  ornamentLine: {
    width: layout.ornamentWidth,
    height: layout.hairline,
    backgroundColor: colors.secondary,
  },
  chapterPlate: {
    gap: spacing.sm,
  },
  chapterPhoto: {
    height: layout.listCardImageHeight + spacing.xl,
    borderRadius: radius.md,
  },
  leadText: {
    paddingLeft: spacing.lg,
    borderLeftWidth: layout.ornamentHeight,
    borderLeftColor: colors.secondary,
  },
  // Completion
  complete: {
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
    alignItems: 'stretch',
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
  },
  emblem: {
    width: layout.emblem + spacing.xl,
    height: layout.emblem + spacing.xl,
    borderRadius: radius.pill,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.secondarySoft,
    borderWidth: 2,
    borderColor: colors.secondary,
    marginBottom: spacing.sm,
  },
  emblemVisited: {
    backgroundColor: colors.successSoft,
    borderColor: colors.success,
  },
  rule: {
    width: layout.ornamentWidth,
    height: layout.ornamentHeight,
    borderRadius: radius.pill,
    backgroundColor: colors.secondary,
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
  visitedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.successSoft,
  },
  centerRow: {
    alignItems: 'center',
  },
  completeActions: {
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  visitCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    marginTop: spacing.xl,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: layout.hairline,
    borderColor: colors.outline,
  },
}));
