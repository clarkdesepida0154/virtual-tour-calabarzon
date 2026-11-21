import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ActivityIndicator } from 'react-native-paper';

import { AppButton } from '@/components/AppButton';
import { AppIcon } from '@/components/AppIcon';
import { AppText } from '@/components/AppText';
import { CoverImage } from '@/components/CoverImage';
import { COVER_MAX_DIMENSION, pickCoverPhoto } from '@/lib/coverPhoto';
import type { PreparedPhoto } from '@/lib/coverPhoto';
import { layout, radius, spacing } from '@/theme';
import { makeStyles, useAppTheme } from '@/theme/ThemeProvider';
import { useI18n } from '@/context/I18nContext';

/** What the form currently holds as the destination's cover photo. */
export type CoverState =
  | { kind: 'none' }
  /** Already stored online (editing an existing destination). */
  | { kind: 'remote'; url: string }
  /** Picked and resized on this device; uploaded when the form is saved. */
  | { kind: 'local'; photo: PreparedPhoto };

type Props = {
  cover: CoverState;
  onChange: (next: CoverState) => void;
  disabled?: boolean;
};

/** Photo picker with a 16:10 preview. Resizes the chosen photo right away. */
export function CoverPhotoField({ cover, onChange, disabled = false }: Props) {
  const styles = useStyles();
  const { colors } = useAppTheme();
  const { t } = useI18n();
  const [isPreparing, setIsPreparing] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const choosePhoto = async () => {
    if (isPreparing || disabled) return;
    setProblem(null);
    setIsPreparing(true);
    try {
      const photo = await pickCoverPhoto();
      if (photo) onChange({ kind: 'local', photo });
    } catch {
      setProblem('We couldn’t use that photo. Please try a different one.');
    } finally {
      setIsPreparing(false);
    }
  };

  const previewUri =
    cover.kind === 'local' ? cover.photo.uri : cover.kind === 'remote' ? cover.url : null;

  return (
    <View style={styles.container}>
      {previewUri ? (
        <View>
          <CoverImage uri={previewUri} label={t('form.photo.selected')} style={styles.preview} />
          {isPreparing ? (
            <View style={styles.busyOverlay}>
              <ActivityIndicator color={colors.onPhoto} />
            </View>
          ) : null}
        </View>
      ) : (
        <Pressable
          onPress={choosePhoto}
          disabled={disabled || isPreparing}
          accessibilityRole="button"
          accessibilityLabel={t('form.photo.add')}
          accessibilityHint={t('form.photo.addHint')}
          style={({ pressed }) => [styles.placeholder, pressed && styles.pressed]}>
          {isPreparing ? (
            <>
              <ActivityIndicator color={colors.primary} />
              <AppText variant="label" color="inkSoft">
                {t('form.photo.preparing')}
              </AppText>
            </>
          ) : (
            <>
              <View style={styles.badge}>
                <AppIcon name="camera-plus-outline" size="lg" color="primary" />
              </View>
              <AppText variant="subtitle">{t('form.photo.add')}</AppText>
              <AppText variant="caption" color="inkSoft" align="center">
                Choose from your gallery. It is resized to {COVER_MAX_DIMENSION}px before upload.
              </AppText>
            </>
          )}
        </Pressable>
      )}

      {previewUri ? (
        <View style={styles.actions}>
          <AppButton
            label={t('form.photo.change')}
            icon="image-edit-outline"
            variant="secondary"
            onPress={choosePhoto}
            disabled={disabled || isPreparing}
            style={styles.action}
          />
          <AppButton
            label={t('form.photo.remove')}
            icon="close"
            variant="text"
            onPress={() => onChange({ kind: 'none' })}
            disabled={disabled || isPreparing}
          />
        </View>
      ) : null}

      {cover.kind === 'local' ? (
        <View style={styles.note}>
          <AppIcon name="check-circle-outline" size="sm" color="success" />
          <AppText variant="caption" color="success" style={styles.noteText}>
            Ready to upload · {cover.photo.width} × {cover.photo.height}px. It uploads when you
            save.
          </AppText>
        </View>
      ) : null}

      {problem ? (
        <View style={styles.note}>
          <AppIcon name="alert-circle-outline" size="sm" color="error" />
          <AppText variant="caption" color="error" style={styles.noteText}>
            {problem}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  container: {
    gap: spacing.md,
  },
  preview: {
    width: '100%',
    aspectRatio: layout.coverAspectRatio,
    borderRadius: radius.md,
  },
  busyOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.scrim,
  },
  placeholder: {
    width: '100%',
    aspectRatio: layout.coverAspectRatio,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    borderWidth: layout.hairline * 2,
    borderStyle: 'dashed',
    borderColor: colors.outlineStrong,
    backgroundColor: colors.background,
  },
  pressed: {
    opacity: layout.pressedOpacity,
  },
  badge: {
    width: layout.iconBadge + spacing.sm,
    height: layout.iconBadge + spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  action: {
    flex: 1,
  },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  noteText: {
    flex: 1,
  },
}));
