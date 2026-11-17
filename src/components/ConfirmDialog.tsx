import { StyleSheet } from 'react-native';
import { Button, Dialog, Portal } from 'react-native-paper';

import { AppText } from '@/components/AppText';
import { colors, radius, typography } from '@/theme';

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
  cancelLabel = 'Cancel',
  destructive = false,
  busy = false,
  onConfirm,
  onCancel,
}: Props) {
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
            {cancelLabel}
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

const styles = StyleSheet.create({
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
});
