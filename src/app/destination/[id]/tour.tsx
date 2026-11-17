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
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, FlatList, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { IconButton } from 'react-native-paper';
import Animated, { FadeIn, FadeInDown, FadeInLeft, FadeInRight } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '@/components/AppButton';
import { AppIcon } from '@/components/AppIcon';
import { AppText } from '@/components/AppText';
import { BestScoreBadge, PageDots, VisitedBadge } from '@/components/Badges';
import { CoverImage } from '@/components/CoverImage';
import { EmptyState, ErrorState } from '@/components/StateViews';
import { CategoryTag } from '@/components/Tag';
import { useDataSync } from '@/context/DataSyncContext';
import { useIdentity } from '@/context/IdentityContext';
import { useToast } from '@/context/ToastContext';
import { useDestination, useDestinationImages } from '@/hooks/useDestinations';
import { useDestinationProgress } from '@/hooks/useProgress';
import { toAppError } from '@/lib/errors';
import { formatDate, formatPlace, splitLead } from '@/lib/format';
import { progressRepository } from '@/repositories';
import { colors, iconSize, layout, motion, radius, spacing } from '@/theme';
import type { Destination, DestinationImage } from '@/types/database';

type Step = 'intro' | 'gallery' | 'history' | 'culture' | 'complete';

/** Steps shown on a dark "gallery wall"; the others sit on warm cream paper. */
const DARK_STEPS: readonly Step[] = ['intro', 'gallery'];

/** A photo to show: the gallery rows, or just the cover when there are none. */
type Plate = { key: string; uri: string; caption: string | null };

export default function VirtualTourScreen() {
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
        <StatusBar style={failed || missing ? 'dark' : 'light'} />
        <CloseButton onPress={close} top={insets.top} dark={!(failed || missing)} />
        {failed ? (
          <ErrorState error={query.error!} onRetry={query.retry} style={styles.centered} />
        ) : missing ? (
          <EmptyState
            icon="map-marker-off-outline"
            title="Destination not found"
            message="This place is no longer in the collection, so its tour can’t be shown."
            actionLabel="Close"
            actionIcon="close"
            onAction={close}
            style={styles.centered}
          />
        ) : (
          <View style={styles.loading} accessibilityLabel="Preparing the tour">
            <ActivityIndicator color={colors.secondary} size="large" />
            <AppText variant="tagline" color="onExhibitSoft">
              Preparing the exhibit…
            </AppText>
          </View>
        )}
      </View>
    );
  }

  const entering = (direction === 'forward' ? FadeInRight : FadeInLeft).duration(motion.step);
  const nextLabel =
    step === 'intro' ? 'Begin the tour' : steps[stepIndex + 1] === 'complete' ? 'Finish the tour' : 'Continue';

  return (
    <View style={[styles.screen, isDark ? styles.wall : styles.paper]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <Animated.View key={step} entering={entering} style={styles.flex}>
        {step === 'intro' ? (
          <IntroStep destination={destination} cover={plates[0]} visited={progress.data?.visited ?? false} />
        ) : step === 'gallery' ? (
          <GalleryStep plates={plates} topInset={insets.top} />
        ) : step === 'history' ? (
          <ChapterStep
            numeral="I"
            title="History"
            icon="book-open-page-variant-outline"
            body={destination.history ?? ''}
            plate={plates[1] ?? plates[0]}
            topInset={insets.top}
          />
        ) : step === 'culture' ? (
          <ChapterStep
            numeral={steps.includes('history') ? 'II' : 'I'}
            title="Cultural Significance"
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
          accessibilityLabel={`Step ${stepIndex + 1} of ${steps.length}`}>
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
            <IconButton
              icon="arrow-left"
              mode="contained"
              size={iconSize.md}
              containerColor={isDark ? colors.glass : colors.surface}
              iconColor={isDark ? colors.onPrimary : colors.ink}
              onPress={() => go(-1)}
              accessibilityLabel="Previous step"
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
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.flex}>
      <CoverImage
        uri={cover?.uri ?? destination.cover_image_url}
        label={`Photo of ${destination.name}`}
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
              A virtual tour
            </AppText>
          </View>
          <AppText variant="exhibitTitle" color="onPrimary" accessibilityRole="header">
            {destination.name}
          </AppText>
          <View style={styles.introMeta}>
            <CategoryTag category={destination.category} tone="overlay" />
            {visited ? <VisitedBadge /> : null}
          </View>
          <View style={styles.introPlace}>
            <AppIcon name="map-marker-outline" size="sm" color="secondary" />
            <AppText variant="subtitle" color="onPrimaryMuted">
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

function GalleryStep({ plates, topInset }: { plates: Plate[]; topInset: number }) {
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
          The gallery
        </AppText>
        <AppText variant="chapterTitle" color="onPrimary" accessibilityRole="header">
          Through the lens
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
                label={`Photo ${itemIndex + 1} of ${plates.length}`}
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
              <IconButton
                icon="chevron-left"
                mode="contained"
                size={iconSize.md}
                containerColor={colors.glass}
                iconColor={colors.onPrimary}
                onPress={() => showPlate(index - 1)}
                accessibilityLabel="Previous photo"
                style={[styles.plateArrow, styles.plateArrowLeft]}
              />
            ) : null}
            {index < plates.length - 1 ? (
              <IconButton
                icon="chevron-right"
                mode="contained"
                size={iconSize.md}
                containerColor={colors.glass}
                iconColor={colors.onPrimary}
                onPress={() => showPlate(index + 1)}
                accessibilityLabel="Next photo"
                style={[styles.plateArrow, styles.plateArrowRight]}
              />
            ) : null}
          </>
        ) : null}
      </View>

      <View style={[styles.plateFooter, { paddingBottom: insets.bottom + layout.actionBarHeight + spacing.lg }]}>
        <PageDots count={plates.length} index={index} />
        <AppText variant="label" color="onExhibitSoft">
          Plate {index + 1} of {plates.length} · swipe to browse
        </AppText>
        {current?.caption ? <Credit caption={current.caption} dark /> : null}
      </View>
    </View>
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
          Chapter {numeral}
        </AppText>
        <AppText variant="chapterTitle" accessibilityRole="header" align="center">
          {title}
        </AppText>
        <View style={styles.ornament}>
          <View style={styles.ornamentLine} />
          <AppIcon name="rhombus-medium" size="xs" color="secondary" />
          <View style={styles.ornamentLine} />
        </View>
      </View>

      {plate ? (
        <View style={styles.chapterPlate}>
          <CoverImage uri={plate.uri} label={`Photo for ${title}`} style={styles.chapterPhoto} />
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
  const router = useRouter();
  const { userKey } = useIdentity();
  const { notifyChanged } = useDataSync();
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);
  // Shown straight away after a successful save, before the refetch lands.
  const [justVisitedAt, setJustVisitedAt] = useState<string | null>(null);

  const isVisited = visited || justVisitedAt !== null;
  const dateLabel = formatDate(visitedAt ?? justVisitedAt);

  const markVisited = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const row = await progressRepository.markVisited(userKey, destination.id);
      setJustVisitedAt(row.completed_at ?? new Date().toISOString());
      notifyChanged();
    } catch (cause) {
      showToast(toAppError(cause, 'We couldn’t mark this destination as visited.').message);
    } finally {
      setSaving(false);
    }
  };

  const takeQuiz = () =>
    router.replace({ pathname: '/destination/[id]/quiz', params: { id: destination.id } });

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
        Tour complete
      </AppText>
      <AppText variant="chapterTitle" align="center" accessibilityRole="header">
        You have toured {destination.name}
      </AppText>
      <View style={styles.rule} />

      {isVisited ? (
        <Animated.View entering={FadeIn.duration(motion.step)} style={styles.visitedCard}>
          <AppIcon name="map-marker-check" size="lg" color="success" />
          <View style={styles.flex}>
            <AppText variant="subtitle" color="success">
              Added to your visited places
            </AppText>
            {dateLabel ? (
              <AppText variant="caption" color="inkSoft">
                Visited on {dateLabel}
              </AppText>
            ) : null}
          </View>
        </Animated.View>
      ) : (
        <AppText variant="bodyLarge" color="inkSoft" align="center">
          Record this stop on your journey. It counts toward your progress across the five provinces.
        </AppText>
      )}

      {best ? (
        <View style={styles.centerRow}>
          <BestScoreBadge score={best.score} total={best.total} />
        </View>
      ) : null}

      <View style={styles.completeActions}>
        {!isVisited ? (
          <AppButton label="Mark as Visited" icon="map-marker-check-outline" onPress={markVisited} loading={saving} />
        ) : null}
        <AppButton
          label={best ? 'Retake the Quiz' : 'Take the Quiz'}
          icon="help-circle-outline"
          variant={isVisited ? 'primary' : 'secondary'}
          onPress={takeQuiz}
          disabled={saving}
          accessibilityHint="Five questions about what you just read"
        />
        <AppButton label="Back to the destination" variant="text" onPress={onClose} disabled={saving} />
      </View>
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Small pieces
// ---------------------------------------------------------------------------

function CloseButton({ onPress, dark, top }: { onPress: () => void; dark: boolean; top?: number }) {
  return (
    <IconButton
      icon="close"
      mode="contained"
      size={iconSize.md}
      containerColor={dark ? colors.glass : colors.surface}
      iconColor={dark ? colors.onPrimary : colors.ink}
      onPress={onPress}
      accessibilityLabel="Close the tour"
      style={top !== undefined ? [styles.floatingClose, { top: top + spacing.sm }] : undefined}
    />
  );
}

/** The photo credit required by the licence, as a quiet caption. */
function Credit({ caption, dark = false }: { caption: string; dark?: boolean }) {
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

const styles = StyleSheet.create({
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
});
