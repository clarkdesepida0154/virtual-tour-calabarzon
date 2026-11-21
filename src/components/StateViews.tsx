import { View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { AppIcon } from '@/components/AppIcon';
import type { IconName } from '@/components/AppIcon';
import { AppText } from '@/components/AppText';
import type { AppError } from '@/lib/errors';
import { layout, radius, spacing } from '@/theme';
import { makeStyles } from '@/theme/ThemeProvider';
import { useI18n } from '@/context/I18nContext';

type MessageProps = {
  icon: IconName;
  title: string;
  message: string;
  actionLabel?: string;
  actionIcon?: IconName;
  onAction?: () => void;
  tone?: 'neutral' | 'error';
  style?: StyleProp<ViewStyle>;
};

function Message({
  icon,
  title,
  message,
  actionLabel,
  actionIcon,
  onAction,
  tone = 'neutral',
  style,
}: MessageProps) {
  const styles = useStyles();
  const isError = tone === 'error';
  return (
    <View style={[styles.container, style]}>
      <View style={[styles.badge, isError && styles.badgeError]}>
        <AppIcon name={icon} size="lg" color={isError ? 'error' : 'secondaryDark'} />
      </View>
      <AppText variant="sectionTitle" align="center">
        {title}
      </AppText>
      <AppText variant="body" color="inkSoft" align="center" style={styles.message}>
        {message}
      </AppText>
      {actionLabel && onAction ? (
        <AppButton
          label={actionLabel}
          icon={actionIcon}
          onPress={onAction}
          variant={isError ? 'primary' : 'secondary'}
          style={styles.action}
        />
      ) : null}
    </View>
  );
}

type EmptyStateProps = Omit<MessageProps, 'tone'>;

/** Friendly "nothing here" message with an optional next step. */
export function EmptyState(props: EmptyStateProps) {
  return <Message {...props} tone="neutral" />;
}

type ErrorStateProps = {
  error: AppError;
  onRetry: () => void;
  style?: StyleProp<ViewStyle>;
};

/** Explains what went wrong in plain language and always offers a retry. */
export function ErrorState({ error, onRetry, style }: ErrorStateProps) {
  const { t, errorTitle, errorMessage } = useI18n();
  return (
    <Message
      icon={error.kind === 'network' ? 'wifi-off' : 'alert-circle-outline'}
      title={errorTitle(error)}
      message={errorMessage(error)}
      actionLabel={t('common.tryAgain')}
      actionIcon="refresh"
      onAction={onRetry}
      tone="error"
      style={style}
    />
  );
}

const useStyles = makeStyles(({ colors }) => ({
  container: {
    alignItems: 'center',
    alignSelf: 'center',
    maxWidth: layout.maxContentWidth,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.xxl,
    gap: spacing.sm,
  },
  badge: {
    width: layout.iconBadge + spacing.xl,
    height: layout.iconBadge + spacing.xl,
    borderRadius: radius.pill,
    backgroundColor: colors.secondarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  badgeError: {
    backgroundColor: colors.errorSoft,
  },
  message: {
    marginBottom: spacing.sm,
  },
  action: {
    marginTop: spacing.sm,
    alignSelf: 'center',
  },
}));
