import { ReactNode, useMemo } from 'react';
import {
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppPalette, type AppPalette } from '@/src/presentation/theme/palette';

type ScreenLayoutProps = {
  children: ReactNode;
  scrollable?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  edges?: Array<'top' | 'right' | 'bottom' | 'left'>;
};

export function ScreenLayout({
  children,
  scrollable = false,
  contentStyle,
  edges = ['top'],
}: ScreenLayoutProps) {
  const palette = useAppPalette();
  const styles = useMemo(() => createStyles(palette), [palette]);

  if (scrollable) {
    return (
      <SafeAreaView style={styles.container} edges={edges}>
        <ScrollView contentContainerStyle={[styles.scrollContent, contentStyle]}>{children}</ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={edges}>
      <View style={[styles.content, contentStyle]}>{children}</View>
    </SafeAreaView>
  );
}

type ScreenHeaderProps = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: ReactNode;
};

export function ScreenHeader({ title, subtitle, onBack, right }: ScreenHeaderProps) {
  const palette = useAppPalette();
  const styles = useMemo(() => createStyles(palette), [palette]);

  return (
    <View style={styles.headerRow}>
      <View style={styles.headerMain}>
        <View style={styles.headerTopRow}>
          {onBack ? (
            <Button label="Back" onPress={onBack} variant="secondary" compact />
          ) : null}
          <Text style={styles.screenTitle}>{title}</Text>
        </View>
        {subtitle ? <Text style={styles.screenSubtitle}>{subtitle}</Text> : null}
      </View>
      {right ? <View>{right}</View> : null}
    </View>
  );
}

type CardProps = {
  children: ReactNode;
  title?: string;
  body?: string;
  meta?: string;
  muted?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Card({ children, title, body, meta, muted = false, style }: CardProps) {
  const palette = useAppPalette();
  const styles = useMemo(() => createStyles(palette), [palette]);

  return (
    <View style={[styles.card, muted && styles.cardMuted, style]}>
      {title ? <Text style={styles.cardTitle}>{title}</Text> : null}
      {body ? <Text style={styles.cardBody}>{body}</Text> : null}
      {meta ? <Text style={styles.cardMeta}>{meta}</Text> : null}
      {children}
    </View>
  );
}

type StateNoticeProps = {
  message: string;
  tone?: 'info' | 'error';
  style?: StyleProp<ViewStyle>;
};

export function StateNotice({ message, tone = 'info', style }: StateNoticeProps) {
  const palette = useAppPalette();
  const styles = useMemo(() => createStyles(palette), [palette]);

  return (
    <View style={style}>
      <Text style={[styles.noticeText, tone === 'error' ? styles.noticeError : styles.noticeInfo]}>
        {message}
      </Text>
    </View>
  );
}

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  compact = false,
  style,
  textStyle,
}: ButtonProps) {
  const palette = useAppPalette();
  const styles = useMemo(() => createStyles(palette), [palette]);

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.buttonBase,
        variant === 'primary' ? styles.buttonPrimary : styles.buttonSecondary,
        compact && styles.buttonCompact,
        disabled && styles.buttonDisabled,
        style,
      ]}
    >
      <Text
        style={[
          styles.buttonText,
          variant === 'primary' ? styles.buttonPrimaryText : styles.buttonSecondaryText,
          textStyle,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const createStyles = (palette: AppPalette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: palette.background,
    },
    content: {
      flex: 1,
      padding: 24,
    },
    scrollContent: {
      padding: 24,
      paddingBottom: 32,
    },
    headerRow: {
      gap: 12,
    },
    headerMain: {
      gap: 8,
    },
    headerTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flexWrap: 'wrap',
    },
    screenTitle: {
      fontSize: 24,
      fontWeight: '600',
      color: palette.text,
    },
    screenSubtitle: {
      fontSize: 14,
      lineHeight: 20,
      color: palette.textSubtle,
    },
    card: {
      marginTop: 20,
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: palette.border,
      backgroundColor: palette.surface,
    },
    cardMuted: {
      opacity: 0.72,
    },
    cardTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: palette.text,
    },
    cardBody: {
      marginTop: 8,
      fontSize: 14,
      lineHeight: 20,
      color: palette.textSubtle,
    },
    cardMeta: {
      marginTop: 8,
      fontSize: 12,
      color: palette.textMuted,
    },
    noticeText: {
      marginTop: 10,
      fontSize: 13,
      lineHeight: 18,
    },
    noticeInfo: {
      color: palette.textSubtle,
    },
    noticeError: {
      color: palette.danger,
    },
    buttonBase: {
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
      minHeight: 44,
      justifyContent: 'center',
      alignItems: 'center',
      alignSelf: 'flex-start',
      borderWidth: 1,
    },
    buttonCompact: {
      minWidth: 44,
      borderRadius: 999,
    },
    buttonPrimary: {
      backgroundColor: palette.primary,
      borderColor: palette.primary,
    },
    buttonSecondary: {
      backgroundColor: palette.secondary,
      borderColor: palette.border,
    },
    buttonDisabled: {
      opacity: 0.55,
    },
    buttonText: {
      fontSize: 13,
      fontWeight: '600',
    },
    buttonPrimaryText: {
      color: palette.primaryText,
    },
    buttonSecondaryText: {
      color: palette.secondaryText,
    },
  });
