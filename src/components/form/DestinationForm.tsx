import { useCallback, useEffect, useRef, useState } from 'react';
import type { ComponentRef, ReactNode } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
} from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '@/components/AppButton';
import { AppIcon } from '@/components/AppIcon';
import type { IconName } from '@/components/AppIcon';
import { AppText } from '@/components/AppText';
import { LinearProgress } from '@/components/LinearProgress';
import { CoverPhotoField } from '@/components/form/CoverPhotoField';
import type { CoverState } from '@/components/form/CoverPhotoField';
import { FormTextField } from '@/components/form/FormTextField';
import { SelectField } from '@/components/form/SelectField';
import type { SelectOption } from '@/components/form/SelectField';
import { CATEGORIES, CATEGORY_META, PROVINCES } from '@/constants/taxonomy';
import type { Category, Province } from '@/constants/taxonomy';
import { useDataSync } from '@/context/DataSyncContext';
import { useToast } from '@/context/ToastContext';
import { base64ToArrayBuffer } from '@/lib/base64';
import {
  EMPTY_FORM_VALUES,
  FIELD_LIMITS,
  firstInvalidField,
  toDestinationInput,
  validateDestinationForm,
  valuesFromDestination,
} from '@/lib/destinationForm';
import type { DestinationFormField, DestinationFormValues } from '@/lib/destinationForm';
import { toAppError } from '@/lib/errors';
import type { AppError } from '@/lib/errors';
import { loadCatalogue } from '@/hooks/useDestinations';
import { syncAutoQuiz } from '@/lib/autoQuiz';
import { destinationImagesRepository, destinationsRepository, quizRepository } from '@/repositories';
import { layout, radius, spacing } from '@/theme';
import { makeStyles } from '@/theme/ThemeProvider';
import type { Destination } from '@/types/database';
import { useI18n } from '@/context/I18nContext';
import type { TranslationKey } from '@/i18n';


/** How long to wait for the keyboard / layout to settle before measuring. */
const REVEAL_DELAY_MS = 120;

type SaveStage = 'uploading' | 'saving';
type ViewRef = ComponentRef<typeof View>;

type Props = {
  /** Pass the destination to edit; leave out to add a new one. */
  destination?: Destination;
  onSaved: (destination: Destination) => void;
  onCancel?: () => void;
};

/**
 * The one form behind both Add and Edit.
 *
 * Saving runs in two visible steps — upload the photo (if a new one was
 * picked), then write the row — and cleans up after itself: a replaced photo
 * is deleted from storage, and a photo uploaded for a save that then fails is
 * removed again.
 */
export function DestinationForm({ destination, onSaved, onCancel }: Props) {
  const styles = useStyles();
  const { t, categoryLabel, provinceTagline, errorMessage } = useI18n();
  // Labels follow the UI language; the stored values stay English.
  const categoryOptions: SelectOption<Category>[] = CATEGORIES.map((category) => ({
    value: category,
    label: categoryLabel(category),
    description: categoryLabel(category, 'blurb'),
    icon: CATEGORY_META[category].icon,
  }));
  const provinceOptions: SelectOption<Province>[] = PROVINCES.map((province) => ({
    value: province,
    label: province,
    description: provinceTagline(province),
    icon: 'map-marker-outline',
  }));
  /** Field errors are i18n keys. */
  const fieldError = (key: TranslationKey | undefined) => (key ? t(key) : undefined);
  const insets = useSafeAreaInsets();
  const { notifyChanged } = useDataSync();
  const { showToast } = useToast();
  const isEditing = destination !== undefined;

  const [values, setValues] = useState<DestinationFormValues>(() =>
    destination ? valuesFromDestination(destination) : EMPTY_FORM_VALUES,
  );
  const [cover, setCover] = useState<CoverState>(() =>
    destination?.cover_image_url
      ? { kind: 'remote', url: destination.cover_image_url }
      : { kind: 'none' },
  );
  const [showErrors, setShowErrors] = useState(false);
  const [stage, setStage] = useState<SaveStage | null>(null);
  const [saveError, setSaveError] = useState<AppError | null>(null);

  const isSaving = stage !== null;
  // Errors appear after the first save attempt, then update live as they are fixed.
  const errors = showErrors ? validateDestinationForm(values) : {};

  const setField = <K extends DestinationFormField>(field: K, value: DestinationFormValues[K]) =>
    setValues((current) => ({ ...current, [field]: value }));

  // --- Keeping the focused input above the keyboard -------------------------
  const viewportRef = useRef<ViewRef>(null);
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const fieldViews = useRef(new Map<DestinationFormField, ViewRef>());
  const scrollOffset = useRef(0);
  const focusedField = useRef<DestinationFormField | null>(null);

  /** Scrolls just enough for the field to sit fully inside the visible area. */
  const revealField = useCallback((field: DestinationFormField) => {
    const fieldView = fieldViews.current.get(field);
    const viewport = viewportRef.current;
    if (!fieldView || !viewport) return;

    viewport.measureInWindow((_x, viewportTop, _width, viewportHeight) => {
      fieldView.measureInWindow((_fx, fieldTop, _fw, fieldHeight) => {
        const margin = spacing.xl;
        const top = fieldTop - viewportTop;
        const bottom = top + fieldHeight;

        let delta = 0;
        if (bottom > viewportHeight - margin) delta = bottom - (viewportHeight - margin);
        // Never scroll the top of a tall field out of view.
        if (top - delta < margin) delta = top - margin;

        if (Math.abs(delta) > 1) {
          scrollRef.current?.scrollTo({
            y: Math.max(0, scrollOffset.current + delta),
            animated: true,
          });
        }
      });
    });
  }, []);

  useEffect(() => {
    // The visible area only shrinks once the keyboard is fully open.
    const subscription = Keyboard.addListener('keyboardDidShow', () => {
      const field = focusedField.current;
      if (field) setTimeout(() => revealField(field), REVEAL_DELAY_MS);
    });
    return () => subscription.remove();
  }, [revealField]);

  const handleFocus = (field: DestinationFormField) => {
    focusedField.current = field;
    setTimeout(() => revealField(field), REVEAL_DELAY_MS);
  };

  const registerField = useCallback((field: DestinationFormField, node: ViewRef | null) => {
    if (node) fieldViews.current.set(field, node);
    else fieldViews.current.delete(field);
  }, []);

  // --- Saving ---------------------------------------------------------------
  const handleSubmit = async () => {
    if (isSaving) return;
    Keyboard.dismiss();

    const found = validateDestinationForm(values);
    const firstInvalid = firstInvalidField(found);
    if (firstInvalid) {
      setShowErrors(true);
      showToast(t('form.errors.fixFields'));
      setTimeout(() => revealField(firstInvalid), REVEAL_DELAY_MS);
      return;
    }

    setSaveError(null);
    let uploadedUrl: string | null = null;
    try {
      let coverUrl = cover.kind === 'remote' ? cover.url : null;
      if (cover.kind === 'local') {
        setStage('uploading');
        uploadedUrl = await destinationImagesRepository.uploadCover(
          base64ToArrayBuffer(cover.photo.base64),
        );
        coverUrl = uploadedUrl;
      }

      setStage('saving');
      const input = toDestinationInput(values, coverUrl);
      const saved = destination
        ? await destinationsRepository.update(destination.id, input)
        : await destinationsRepository.create(input);

      // The old photo is no longer referenced — remove it from storage.
      const previousUrl = destination?.cover_image_url;
      if (destination && previousUrl && previousUrl !== saved.cover_image_url) {
        void destinationImagesRepository.removeByPublicUrl(previousUrl);
        // ...and drop its row (and credit line) from the destination's photo list.
        void destinationImagesRepository.removeRecordByUrl(destination.id, previousUrl);
      }

      // Run 6: a user-added destination gets an auto-generated starter quiz
      // (re-generated when a quiz field changes; curated quizzes are never
      // touched). Best-effort — a failure here never undoes the save.
      try {
        await syncAutoQuiz({ quiz: quizRepository, saved, previous: destination ?? null, catalogue: await loadCatalogue() });
      } catch {
        // The entry is saved; its quiz can be generated on the next edit.
      }

      notifyChanged();
      onSaved(saved);
    } catch (cause) {
      // Don't leave an orphaned upload behind when the row could not be saved.
      if (uploadedUrl) void destinationImagesRepository.removeByPublicUrl(uploadedUrl);
      setSaveError(toAppError(cause, 'saveDestination'));
    } finally {
      setStage(null);
    }
  };

  const stepCount = cover.kind === 'local' ? 2 : 1;
  const stageLabel =
    stage === 'uploading'
      ? t('form.uploading', { count: stepCount })
      : t('form.saving', { count: stepCount });

  return (
    <KeyboardAvoidingView style={styles.flex} behavior="padding">
      <View ref={viewportRef} collapsable={false} style={styles.flex}>
        <ScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'none'}
          scrollEventThrottle={16}
          onScroll={(event) => {
            scrollOffset.current = event.nativeEvent.contentOffset.y;
          }}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + layout.snackbarOffset + spacing.xl },
          ]}>
          <FormSection
            icon="image-outline"
            title={t('form.coverSection')}
            subtitle={t('form.coverSubtitle')}>
            <CoverPhotoField cover={cover} onChange={setCover} disabled={isSaving} />
          </FormSection>

          <FormSection icon="bank-outline" title={t('form.aboutSection')}>
            <FieldAnchor field="name" onRegister={registerField}>
              <FormTextField
                label={t('form.name')}
                required
                value={values.name}
                onChangeText={(text) => setField('name', text)}
                onFocus={() => handleFocus('name')}
                error={fieldError(errors.name)}
                maxLength={FIELD_LIMITS.name}
                autoCapitalize="words"
                disabled={isSaving}
              />
            </FieldAnchor>
            <FieldAnchor field="category" onRegister={registerField}>
              <SelectField
                label={t('form.category')}
                title={t('form.chooseCategory')}
                required
                options={categoryOptions}
                value={values.category}
                onChange={(category) => setField('category', category)}
                error={fieldError(errors.category)}
                disabled={isSaving}
              />
            </FieldAnchor>
            <FieldAnchor field="description" onRegister={registerField}>
              <FormTextField
                label={t('form.description')}
                required
                multiline
                value={values.description}
                onChangeText={(text) => setField('description', text)}
                onFocus={() => handleFocus('description')}
                error={fieldError(errors.description)}
                helper={t('form.descriptionHelper')}
                maxLength={FIELD_LIMITS.description}
                disabled={isSaving}
              />
            </FieldAnchor>
          </FormSection>

          <FormSection icon="map-marker-outline" title={t('form.locationSection')}>
            <FieldAnchor field="province" onRegister={registerField}>
              <SelectField
                label={t('form.province')}
                title={t('form.chooseProvince')}
                required
                options={provinceOptions}
                value={values.province}
                onChange={(province) => setField('province', province)}
                error={fieldError(errors.province)}
                disabled={isSaving}
              />
            </FieldAnchor>
            <FieldAnchor field="municipality" onRegister={registerField}>
              <FormTextField
                label={t('form.municipality')}
                value={values.municipality}
                onChangeText={(text) => setField('municipality', text)}
                onFocus={() => handleFocus('municipality')}
                error={fieldError(errors.municipality)}
                maxLength={FIELD_LIMITS.municipality}
                autoCapitalize="words"
                disabled={isSaving}
              />
            </FieldAnchor>
            <FieldAnchor field="address" onRegister={registerField}>
              <FormTextField
                label={t('form.address')}
                required
                value={values.address}
                onChangeText={(text) => setField('address', text)}
                onFocus={() => handleFocus('address')}
                error={fieldError(errors.address)}
                maxLength={FIELD_LIMITS.address}
                disabled={isSaving}
              />
            </FieldAnchor>
            <View style={styles.coordinates}>
              <FieldAnchor field="latitude" onRegister={registerField} style={styles.flex}>
                <FormTextField
                  label={t('form.latitude')}
                  value={values.latitude}
                  onChangeText={(text) => setField('latitude', text)}
                  onFocus={() => handleFocus('latitude')}
                  error={fieldError(errors.latitude)}
                  placeholder="14.2136"
                  keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'numeric'}
                  autoCapitalize="none"
                  disabled={isSaving}
                />
              </FieldAnchor>
              <FieldAnchor field="longitude" onRegister={registerField} style={styles.flex}>
                <FormTextField
                  label={t('form.longitude')}
                  value={values.longitude}
                  onChangeText={(text) => setField('longitude', text)}
                  onFocus={() => handleFocus('longitude')}
                  error={fieldError(errors.longitude)}
                  placeholder="121.1669"
                  keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'numeric'}
                  autoCapitalize="none"
                  disabled={isSaving}
                />
              </FieldAnchor>
            </View>
            <AppText variant="caption" color="inkSoft">
              {t('form.coordinatesNote')}
            </AppText>
          </FormSection>

          <FormSection
            icon="book-open-page-variant-outline"
            title={t('form.tourSection')}
            subtitle={t('form.tourSubtitle')}>
            <FieldAnchor field="history" onRegister={registerField}>
              <FormTextField
                label={t('form.history')}
                multiline
                value={values.history}
                onChangeText={(text) => setField('history', text)}
                onFocus={() => handleFocus('history')}
                error={fieldError(errors.history)}
                maxLength={FIELD_LIMITS.longText}
                disabled={isSaving}
              />
            </FieldAnchor>
            <FieldAnchor field="culturalSignificance" onRegister={registerField}>
              <FormTextField
                label={t('form.culture')}
                multiline
                value={values.culturalSignificance}
                onChangeText={(text) => setField('culturalSignificance', text)}
                onFocus={() => handleFocus('culturalSignificance')}
                error={fieldError(errors.culturalSignificance)}
                maxLength={FIELD_LIMITS.longText}
                disabled={isSaving}
              />
            </FieldAnchor>
          </FormSection>

          <View style={styles.footer}>
            {saveError ? (
              <View style={styles.errorBanner} accessibilityRole="alert">
                <AppIcon
                  name={saveError.kind === 'network' ? 'wifi-off' : 'alert-circle-outline'}
                  size="md"
                  color="error"
                />
                <AppText variant="body" color="error" style={styles.flex}>
                  {errorMessage(saveError)}
                </AppText>
              </View>
            ) : null}

            {isSaving ? (
              <View style={styles.progress} accessibilityRole="progressbar" accessibilityLabel={stageLabel}>
                <LinearProgress tone="track" />
                <AppText variant="label" color="inkSoft" align="center">
                  {stageLabel}
                </AppText>
              </View>
            ) : null}

            <AppButton
              label={t(isEditing ? 'form.saveChanges' : 'form.addDestination')}
              icon="check"
              onPress={handleSubmit}
              loading={isSaving}
            />
            {onCancel ? (
              <AppButton label={t('form.cancel')} variant="text" onPress={onCancel} disabled={isSaving} />
            ) : null}
            <AppText variant="caption" color="muted" align="center">
              {t('form.required')}
            </AppText>
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

type FieldAnchorProps = {
  field: DestinationFormField;
  onRegister: (field: DestinationFormField, node: ViewRef | null) => void;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
};

/**
 * Wraps one field so the form can measure where it is and scroll it clear of
 * the keyboard. `collapsable={false}` keeps Android from optimising the view
 * away, which would make it unmeasurable.
 */
function FieldAnchor({ field, onRegister, style, children }: FieldAnchorProps) {
  return (
    <View ref={(node) => onRegister(field, node)} collapsable={false} style={style}>
      {children}
    </View>
  );
}

type FormSectionProps = {
  icon: IconName;
  title: string;
  subtitle?: string;
  children: ReactNode;
};

/** A white card grouping related fields under a serif heading. */
function FormSection({ icon, title, subtitle, children }: FormSectionProps) {
  const styles = useStyles();
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionIcon}>
          <AppIcon name={icon} size="sm" color="secondaryDark" />
        </View>
        <View style={styles.flex}>
          <AppText variant="cardTitle" accessibilityRole="header">
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

const useStyles = makeStyles(({ colors, elevation }) => ({
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.lg,
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
  },
  section: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.md,
    ...elevation.card,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.xs,
  },
  sectionIcon: {
    width: spacing.xxl + spacing.xs,
    height: spacing.xxl + spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.secondarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coordinates: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  footer: {
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.errorSoft,
  },
  progress: {
    gap: spacing.sm,
  },
}));
