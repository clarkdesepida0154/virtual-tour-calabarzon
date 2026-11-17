import { createContext, use, useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { Snackbar } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, layout, motion, radius, spacing } from '@/theme';

type ToastValue = {
  /** Shows a brief confirmation at the bottom of the screen. */
  showToast: (message: string) => void;
};

const ToastContext = createContext<ToastValue | null>(null);

/** App-wide snackbar, so a message survives the navigation that follows it. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  // A new object per call, so repeating the same message shows it again.
  const [toast, setToast] = useState<{ message: string } | null>(null);

  const showToast = useCallback((message: string) => setToast({ message }), []);
  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext value={value}>
      {children}
      <Snackbar
        visible={toast !== null}
        onDismiss={() => setToast(null)}
        duration={motion.toast}
        action={{ label: 'OK', onPress: () => setToast(null) }}
        wrapperStyle={[styles.wrapper, { bottom: insets.bottom + layout.snackbarOffset }]}
        style={styles.snackbar}>
        {toast?.message ?? ''}
      </Snackbar>
    </ToastContext>
  );
}

export function useToast(): ToastValue {
  const value = use(ToastContext);
  if (!value) throw new Error('useToast must be used inside <ToastProvider>.');
  return value;
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: spacing.sm,
  },
  snackbar: {
    backgroundColor: colors.ink,
    borderRadius: radius.md,
  },
});
