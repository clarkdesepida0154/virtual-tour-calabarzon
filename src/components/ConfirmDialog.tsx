import { Button, Dialog, Portal } from 'react-native-paper';

import { AppText } from '@/components/AppText';
import { radius, typography } from '@/theme';
import { makeStyles, useAppTheme } from '@/theme/ThemeProvider';
import { useI18n } from '@/context/I18nContext';

type Props = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** Styles the confirm action as dangerous (delete). */
  destructive?: boolean;
  /** Disables both actions and shows a spinner while the action runs. */
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/** Modal "are you sure?" used before anything irreversible. */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel,
  destructive = false,
  busy = false,
  onConfirm,
  onCancel,
}: Props) {
  const styles = useStyles();
  const { t } = useI18n();
  const { colors } = useAppTheme();
  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onCancel} dismissable={!busy} style={styles.dialog}>
        <Dialog.Title style={styles.title}>{title}</Dialog.Title>
        <Dialog.Content>
          <AppText variant="body" color="inkSoft">
            {message}
          </AppText>
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onCancel} disabled={busy} textColor={colors.inkSoft} labelStyle={styles.label}>
            {cancelLabel ?? t('common.cancel')}
          </Button>
          <Button
            onPress={onConfirm}
            loading={busy}
            disabled={busy}
            textColor={destructive ? colors.error : colors.primary}
            labelStyle={styles.label}>
            {confirmLabel}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  dialog: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
  },
  title: {
    ...typography.sectionTitle,
    color: colors.ink,
  },
  label: {
    ...typography.button,
  },
}));
