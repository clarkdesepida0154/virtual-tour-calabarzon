/**
 * Quiz — five multiple-choice questions about one destination.
 *
 *   Intro card → one question at a time → score screen
 *
 * Options are shuffled for every attempt (quiz_options has no order column).
 * Picking an option locks the question and reveals the answer at once. Every
 * finished attempt is saved under the current user key; the best one is what
 * Details and Progress show.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ActivityIndicator, BackHandler, ScrollView, StyleSheet, View } from 'react-native';
import { IconButton } from 'react-native-paper';
import Animated, { FadeIn, FadeInRight, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '@/components/AppButton';
import { AppIcon } from '@/components/AppIcon';
import { AppText } from '@/components/AppText';
import { Badge, BestScoreBadge } from '@/components/Badges';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ProgressRing } from '@/components/ProgressRing';
import { QuizOptionCard } from '@/components/QuizOptionCard';
import type { OptionState } from '@/components/QuizOptionCard';
import { EmptyState, ErrorState } from '@/components/StateViews';
import { useDataSync } from '@/context/DataSyncContext';
import { useIdentity } from '@/context/IdentityContext';
import { useDestination } from '@/hooks/useDestinations';
import { useDestinationProgress, useQuiz } from '@/hooks/useProgress';
import { toAppError } from '@/lib/errors';
import type { BestScore } from '@/lib/progress';
import { isCorrectAnswer, prepareQuiz, resultMessage, resultTone, scoreQuiz } from '@/lib/quiz';
import type { QuizAnswers, QuizScore } from '@/lib/quiz';
import { progressRepository } from '@/repositories';
import { colors, elevation, iconSize, layout, motion, radius, spacing } from '@/theme';
import type { QuizQuestionWithOptions } from '@/types/database';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

type Phase = 'intro' | 'question' | 'result';
type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export default function QuizScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { userKey } = useIdentity();
  const { notifyChanged } = useDataSync();
  const destination = useDestination(id);
  const quiz = useQuiz(id);
  const progress = useDestinationProgress(id);

  const [phase, setPhase] = useState<Phase>('intro');
  const [questions, setQuestions] = useState<QuizQuestionWithOptions[]>([]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswers>({});
  const [result, setResult] = useState<QuizScore | null>(null);
  const [previousBest, setPreviousBest] = useState<BestScore | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [confirmLeave, setConfirmLeave] = useState(false);

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace({ pathname: '/destination/[id]', params: { id } });
  };

  // Leaving mid-quiz throws the answers away, so ask first.
  const requestClose = () => {
    if (phase === 'question' && Object.keys(answers).length > 0) setConfirmLeave(true);
    else close();
  };

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (phase === 'question' && Object.keys(answers).length > 0) {
        setConfirmLeave(true);
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  }, [phase, answers]);

  const start = () => {
    if (!quiz.data || quiz.data.length === 0) return;
    setQuestions(prepareQuiz(quiz.data));
    setIndex(0);
    setAnswers({});
    setResult(null);
    setSaveState('idle');
    setPreviousBest(progress.data?.best ?? null);
    setPhase('question');
  };

  const save = async (score: QuizScore) => {
    setSaveState('saving');
    try {
      await progressRepository.recordAttempt({
        userKey,
        destinationId: id,
        score: score.score,
        total: score.total,
      });
      setSaveState('saved');
      notifyChanged();
    } catch {
      setSaveState('error');
    }
  };

  const answer = (questionId: string, optionId: string) => {
    if (answers[questionId]) return;
    setAnswers((current) => ({ ...current, [questionId]: optionId }));
  };

  const next = () => {
    if (index < questions.length - 1) {
      setIndex(index + 1);
      return;
    }
    const score = scoreQuiz(questions, answers);
    setResult(score);
    setPhase('result');
    void save(score);
  };

  // --- Loading / errors ------------------------------------------------------
  const name = destination.data?.name ?? '';
  let body: ReactNode;

  if (quiz.status === 'error' && quiz.error) {
    body = <ErrorState error={quiz.error} onRetry={quiz.retry} style={styles.state} />;
  } else if (!quiz.data || destination.status === 'loading') {
    body = (
      <View style={styles.loading} accessibilityLabel="Loading the quiz">
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  } else if (quiz.data.length === 0 || !destination.data) {
    body = (
      <EmptyState
        icon="help-circle-outline"
        title="No quiz for this place yet"
        message="Quizzes come with the destinations in the curated collection. Explore another destination to test your knowledge."
        actionLabel="Back"
        actionIcon="arrow-left"
        onAction={close}
        style={styles.state}
      />
    );
  } else if (phase === 'intro') {
    body = (
      <IntroCard
        name={name}
        count={quiz.data.length}
        best={progress.data?.best ?? null}
        attempts={progress.data?.attempts ?? 0}
        onStart={start}
      />
    );
  } else if (phase === 'question') {
    const question = questions[index];
    body = (
      <QuestionView
        key={question.id}
        question={question}
        index={index}
        total={questions.length}
        picked={answers[question.id]}
        onPick={(optionId) => answer(question.id, optionId)}
        onNext={next}
        bottomInset={insets.bottom}
      />
    );
  } else if (result) {
    body = (
      <ResultView
        name={name}
        result={result}
        previousBest={previousBest}
        saveState={saveState}
        onRetrySave={() => void save(result)}
        onRetake={start}
        onBack={close}
        onTour={() => router.replace({ pathname: '/destination/[id]/tour', params: { id } })}
        bottomInset={insets.bottom}
      />
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.flex}>
          <AppText variant="overline" color="secondaryDark" numberOfLines={1}>
            Knowledge check
          </AppText>
          <AppText variant="cardTitleSmall" numberOfLines={1}>
            {name || 'Quiz'}
          </AppText>
        </View>
        <IconButton
          icon="close"
          mode="contained"
          size={iconSize.md}
          containerColor={colors.surface}
          iconColor={colors.ink}
          onPress={requestClose}
          accessibilityLabel="Close the quiz"
          style={styles.outlined}
        />
      </View>

      <View style={styles.flex}>{body}</View>

      <ConfirmDialog
        visible={confirmLeave}
        title="Leave the quiz?"
        message="Your answers so far won’t be saved. You can start again any time."
        confirmLabel="Leave"
        cancelLabel="Keep going"
        onConfirm={() => {
          setConfirmLeave(false);
          close();
        }}
        onCancel={() => setConfirmLeave(false)}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Phases
// ---------------------------------------------------------------------------

function IntroCard({
  name,
  count,
  best,
  attempts,
  onStart,
}: {
  name: string;
  count: number;
  best: BestScore | null;
  attempts: number;
  onStart: () => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.centerContent} showsVerticalScrollIndicator={false}>
      <Animated.View entering={FadeIn.duration(motion.step)} style={styles.introCard}>
        <View style={styles.introEmblem}>
          <AppIcon name="head-question-outline" size="xl" color="secondaryDark" />
        </View>
        <AppText variant="sectionTitle" align="center" accessibilityRole="header">
          How well do you know {name}?
        </AppText>
        <View style={styles.rule} />
        <View style={styles.introFacts}>
          <IntroFact icon="format-list-numbered" text={`${count} multiple-choice questions`} />
          <IntroFact icon="book-open-page-variant-outline" text="Every answer is in the virtual tour" />
          <IntroFact icon="refresh" text="Retake as often as you like — your best score is kept" />
        </View>
        {best ? (
          <View style={styles.introBest}>
            <BestScoreBadge score={best.score} total={best.total} />
            <AppText variant="caption" color="muted">
              {attempts} {attempts === 1 ? 'attempt' : 'attempts'} so far
            </AppText>
          </View>
        ) : null}
        <AppButton
          label={best ? 'Retake the quiz' : 'Start the quiz'}
          icon="play"
          onPress={onStart}
          style={styles.stretch}
        />
      </Animated.View>
    </ScrollView>
  );
}

function IntroFact({ icon, text }: { icon: 'format-list-numbered' | 'book-open-page-variant-outline' | 'refresh'; text: string }) {
  return (
    <View style={styles.introFact}>
      <AppIcon name={icon} size="sm" color="primary" />
      <AppText variant="body" color="inkSoft" style={styles.flex}>
        {text}
      </AppText>
    </View>
  );
}

function QuestionView({
  question,
  index,
  total,
  picked,
  onPick,
  onNext,
  bottomInset,
}: {
  question: QuizQuestionWithOptions;
  index: number;
  total: number;
  picked: string | undefined;
  onPick: (optionId: string) => void;
  onNext: () => void;
  bottomInset: number;
}) {
  const answered = picked !== undefined;
  const correct = answered && isCorrectAnswer(question, picked);
  const isLast = index === total - 1;

  const stateOf = (optionId: string, isCorrect: boolean): OptionState => {
    if (!answered) return 'idle';
    if (isCorrect) return 'correct';
    if (optionId === picked) return 'wrong';
    return 'dimmed';
  };

  return (
    <View style={styles.flex}>
      <ScrollView
        contentContainerStyle={[styles.questionContent, { paddingBottom: layout.actionBarHeight + bottomInset + spacing.xl }]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.progressRow} accessible accessibilityLabel={`Question ${index + 1} of ${total}`}>
          {Array.from({ length: total }, (_, step) => (
            <View
              key={step}
              style={[styles.progressSegment, { backgroundColor: colors[step <= index ? 'primary' : 'outline'] }]}
            />
          ))}
        </View>

        <Animated.View entering={FadeInRight.duration(motion.step)} style={styles.questionBlock}>
          <AppText variant="overline" color="secondaryDark">
            Question {index + 1} of {total}
          </AppText>
          <AppText variant="question" accessibilityRole="header">
            {question.question_text}
          </AppText>
        </Animated.View>

        <View style={styles.options}>
          {question.options.map((option, optionIndex) => (
            <QuizOptionCard
              key={option.id}
              letter={LETTERS[optionIndex] ?? String(optionIndex + 1)}
              text={option.option_text}
              state={stateOf(option.id, option.is_correct)}
              picked={option.id === picked}
              disabled={answered}
              onPress={() => onPick(option.id)}
            />
          ))}
        </View>

        {answered ? (
          <Animated.View
            entering={FadeIn.duration(motion.normal)}
            style={[styles.feedback, correct ? styles.feedbackRight : styles.feedbackWrong]}
            accessibilityLiveRegion="polite">
            <AppIcon name={correct ? 'check-circle' : 'information'} size="md" color={correct ? 'success' : 'primary'} />
            <AppText variant="bodyStrong" color={correct ? 'success' : 'primaryDark'} style={styles.flex}>
              {correct ? 'Correct — well done!' : 'Not quite. The correct answer is highlighted in green.'}
            </AppText>
          </Animated.View>
        ) : null}
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: bottomInset + spacing.md }]}>
        <AppButton
          label={isLast ? 'See my score' : 'Next question'}
          icon={isLast ? 'flag-checkered' : 'arrow-right'}
          onPress={onNext}
          disabled={!answered}
          style={styles.flex}
          accessibilityHint={answered ? undefined : 'Pick an answer first'}
        />
      </View>
    </View>
  );
}

function ResultView({
  name,
  result,
  previousBest,
  saveState,
  onRetrySave,
  onRetake,
  onBack,
  onTour,
  bottomInset,
}: {
  name: string;
  result: QuizScore;
  previousBest: BestScore | null;
  saveState: SaveState;
  onRetrySave: () => void;
  onRetake: () => void;
  onBack: () => void;
  onTour: () => void;
  bottomInset: number;
}) {
  const tone = resultTone(result);
  const celebrate = tone === 'celebrate';
  const { title, message } = resultMessage(result);
  const isNewBest =
    previousBest !== null && result.score / Math.max(1, result.total) > previousBest.score / Math.max(1, previousBest.total);

  return (
    <ScrollView
      contentContainerStyle={[styles.resultContent, { paddingBottom: bottomInset + spacing.xxl }]}
      showsVerticalScrollIndicator={false}>
      <Animated.View entering={ZoomIn.duration(motion.step * 1.5)} style={styles.ringWrap}>
        {celebrate ? (
          <View style={styles.laurels} pointerEvents="none">
            <AppIcon name="star-four-points" size="lg" color="secondary" />
            <AppIcon name="star-four-points" size="sm" color="secondary" />
          </View>
        ) : null}
        <ProgressRing
          progress={result.total > 0 ? result.score / result.total : 0}
          color={celebrate ? 'success' : 'primary'}
          accessibilityLabel={`You scored ${result.score} out of ${result.total}, ${result.percent} percent`}>
          <AppText variant="score" color={celebrate ? 'success' : 'primary'}>
            {result.score}
            <AppText variant="stat" color="muted">
              /{result.total}
            </AppText>
          </AppText>
          <AppText variant="label" color="inkSoft">
            {result.percent}%
          </AppText>
        </ProgressRing>
      </Animated.View>

      <View style={styles.resultBadges}>
        {celebrate ? <Badge icon="trophy" label="Heritage scholar" tone="gold" /> : null}
        {isNewBest ? <Badge icon="arrow-up-bold" label="New best" tone="success" /> : null}
      </View>

      <AppText variant="screenTitle" align="center" accessibilityRole="header">
        {title}
      </AppText>
      <AppText variant="bodyLarge" color="inkSoft" align="center">
        {message}
      </AppText>
      <AppText variant="caption" color="muted" align="center">
        Quiz · {name}
      </AppText>

      <SaveStatus state={saveState} onRetry={onRetrySave} />

      <View style={styles.resultActions}>
        <AppButton label="Retake the quiz" icon="refresh" onPress={onRetake} />
        <AppButton label="Back to the destination" icon="arrow-left" variant="secondary" onPress={onBack} />
        {!celebrate ? (
          <AppButton label="Take the virtual tour again" icon="walk" variant="text" onPress={onTour} />
        ) : null}
      </View>
    </ScrollView>
  );
}

function SaveStatus({ state, onRetry }: { state: SaveState; onRetry: () => void }) {
  if (state === 'idle') return null;
  if (state === 'error') {
    return (
      <View style={[styles.saveRow, styles.saveError]} accessibilityRole="alert">
        <AppIcon name="cloud-alert" size="sm" color="error" />
        <AppText variant="label" color="error" style={styles.flex}>
          {toAppError(null, 'Your score wasn’t saved.').message}
        </AppText>
        <AppButton label="Retry" variant="text" onPress={onRetry} />
      </View>
    );
  }
  return (
    <View style={styles.saveRow} accessibilityLiveRegion="polite">
      {state === 'saving' ? (
        <ActivityIndicator size="small" color={colors.muted} />
      ) : (
        <AppIcon name="cloud-check-outline" size="sm" color="success" />
      )}
      <AppText variant="label" color={state === 'saving' ? 'muted' : 'success'}>
        {state === 'saving' ? 'Saving your score…' : 'Score saved to your progress'}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  stretch: {
    alignSelf: 'stretch',
  },
  state: {
    marginTop: spacing.xxl,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingLeft: spacing.xl,
    paddingRight: spacing.sm,
    paddingBottom: spacing.sm,
  },
  outlined: {
    borderWidth: layout.hairline,
    borderColor: colors.outlineStrong,
  },
  rule: {
    width: layout.ornamentWidth,
    height: layout.ornamentHeight,
    borderRadius: radius.pill,
    backgroundColor: colors.secondary,
    alignSelf: 'center',
  },
  // Intro
  centerContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  introCard: {
    alignItems: 'center',
    gap: spacing.lg,
    padding: spacing.xl,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
    ...elevation.raised,
  },
  introEmblem: {
    width: layout.emblem,
    height: layout.emblem,
    borderRadius: radius.pill,
    backgroundColor: colors.secondarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  introFacts: {
    alignSelf: 'stretch',
    gap: spacing.md,
  },
  introFact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  introBest: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  // Question
  questionContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    gap: spacing.xl,
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
  },
  progressRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  progressSegment: {
    flex: 1,
    height: layout.stepSegmentHeight + 1,
    borderRadius: radius.pill,
  },
  questionBlock: {
    gap: spacing.sm,
  },
  options: {
    gap: spacing.md,
  },
  feedback: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.md,
  },
  feedbackRight: {
    backgroundColor: colors.successSoft,
  },
  feedbackWrong: {
    backgroundColor: colors.primarySoft,
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: layout.hairline,
    borderTopColor: colors.outline,
    ...elevation.bar,
  },
  // Result
  resultContent: {
    alignItems: 'stretch',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
  },
  ringWrap: {
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
  laurels: {
    position: 'absolute',
    top: -spacing.sm,
    right: -spacing.lg,
    alignItems: 'center',
    gap: spacing.xs,
  },
  resultBadges: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  saveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: layout.touchTarget,
  },
  saveError: {
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.errorSoft,
  },
  resultActions: {
    gap: spacing.md,
    marginTop: spacing.md,
  },
});
