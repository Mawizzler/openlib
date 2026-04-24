import { ReactNode, useMemo } from 'react';
import {
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
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

type StackProps = {
  children: ReactNode;
  gap?: number;
  style?: StyleProp<ViewStyle>;
};

export function Stack({ children, gap = 12, style }: StackProps) {
  return <View style={[{ gap }, style]}>{children}</View>;
}

type InlineProps = {
  children: ReactNode;
  gap?: number;
  wrap?: boolean;
  align?: ViewStyle['alignItems'];
  justify?: ViewStyle['justifyContent'];
  style?: StyleProp<ViewStyle>;
};

export function Inline({
  children,
  gap = 12,
  wrap = true,
  align = 'center',
  justify,
  style,
}: InlineProps) {
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: align,
          justifyContent: justify,
          gap,
          flexWrap: wrap ? 'wrap' : 'nowrap',
        },
        style,
      ]}
    >
      {children}
    </View>
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
    <Inline justify="space-between" align="flex-start" wrap={false} style={styles.headerRow}>
      <Stack gap={8} style={styles.headerMain}>
        <Inline gap={12} align="center" style={styles.headerTopRow}>
          {onBack ? <Button label="Back" onPress={onBack} variant="secondary" compact /> : null}
          <Text style={styles.screenTitle}>{title}</Text>
        </Inline>
        {subtitle ? <Text style={styles.screenSubtitle}>{subtitle}</Text> : null}
      </Stack>
      {right ? <View>{right}</View> : null}
    </Inline>
  );
}

type CardProps = {
  children?: ReactNode;
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
      {children ? <Stack gap={12} style={styles.cardContent}>{children}</Stack> : null}
    </View>
  );
}

type SectionCardProps = CardProps & {
  footer?: ReactNode;
};

export function SectionCard({ footer, children, ...props }: SectionCardProps) {
  const palette = useAppPalette();
  const styles = useMemo(() => createStyles(palette), [palette]);

  return (
    <Card {...props}>
      {children}
      {footer ? <View style={styles.cardFooter}>{footer}</View> : null}
    </Card>
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
    <View style={[styles.noticeBox, tone === 'error' ? styles.noticeBoxError : styles.noticeBoxInfo, style]}>
      <Text style={[styles.noticeText, tone === 'error' ? styles.noticeError : styles.noticeInfo]}>
        {message}
      </Text>
    </View>
  );
}

type BadgeTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger';

type BadgeProps = {
  label: string;
  tone?: BadgeTone;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
};

export function Badge({ label, tone = 'neutral', style, textStyle }: BadgeProps) {
  const palette = useAppPalette();
  const styles = useMemo(() => createStyles(palette), [palette]);

  return (
    <View
      style={[
        styles.badge,
        tone === 'primary' && styles.badgePrimary,
        tone === 'success' && styles.badgeSuccess,
        tone === 'warning' && styles.badgeWarning,
        tone === 'danger' && styles.badgeDanger,
        style,
      ]}
    >
      <Text
        style={[
          styles.badgeText,
          tone === 'primary' && styles.badgeTextPrimary,
          tone === 'success' && styles.badgeTextSuccess,
          tone === 'warning' && styles.badgeTextWarning,
          tone === 'danger' && styles.badgeTextDanger,
          textStyle,
        ]}
      >
        {label}
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

type AppTextInputProps = TextInputProps & {
  style?: StyleProp<TextStyle>;
};

export function Input({ style, placeholderTextColor, ...props }: AppTextInputProps) {
  const palette = useAppPalette();
  const styles = useMemo(() => createStyles(palette), [palette]);

  return (
    <TextInput
      {...props}
      placeholderTextColor={placeholderTextColor ?? palette.inputPlaceholder}
      style={[styles.input, style]}
    />
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
      gap: 20,
    },
    scrollContent: {
      padding: 24,
      paddingBottom: 32,
      gap: 20,
    },
    headerRow: {
      gap: 12,
    },
    headerMain: {
      flex: 1,
    },
    headerTopRow: {
      flexShrink: 1,
    },
    screenTitle: {
      fontSize: 24,
      fontWeight: '600',
      color: palette.text,
      flexShrink: 1,
    },
    screenSubtitle: {
      fontSize: 14,
      lineHeight: 20,
      color: palette.textSubtle,
    },
    card: {
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: palette.border,
      backgroundColor: palette.surface,
      gap: 8,
    },
    cardMuted: {
      opacity: 0.72,
    },
    cardTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: palette.text,
    },
    cardBody: {
      fontSize: 14,
      lineHeight: 20,
      color: palette.textSubtle,
    },
    cardMeta: {
      fontSize: 12,
      lineHeight: 18,
      color: palette.textMuted,
    },
    cardContent: {
      marginTop: 4,
    },
    cardFooter: {
      marginTop: 4,
    },
    noticeBox: {
      borderRadius: 10,
      borderWidth: 1,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    noticeBoxInfo: {
      borderColor: palette.border,
      backgroundColor: palette.surfaceMuted,
    },
    noticeBoxError: {
      borderColor: palette.danger,
      backgroundColor: palette.surfaceMuted,
    },
    noticeText: {
      fontSize: 13,
      lineHeight: 18,
    },
    noticeInfo: {
      color: palette.textSubtle,
    },
    noticeError: {
      color: palette.danger,
    },
    badge: {
      alignSelf: 'flex-start',
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: palette.border,
      backgroundColor: palette.surfaceMuted,
    },
    badgePrimary: {
      borderColor: palette.primary,
      backgroundColor: palette.primary,
    },
    badgeSuccess: {
      borderColor: '#5abf88',
      backgroundColor: '#e7f8ef',
    },
    badgeWarning: {
      borderColor: '#e1a23a',
      backgroundColor: '#fff6e8',
    },
    badgeDanger: {
      borderColor: '#d66767',
      backgroundColor: '#ffecec',
    },
    badgeText: {
      fontSize: 11,
      fontWeight: '600',
      color: palette.text,
    },
    badgeTextPrimary: {
      color: palette.primaryText,
    },
    badgeTextSuccess: {
      color: '#1f7a4d',
    },
    badgeTextWarning: {
      color: '#a06a16',
    },
    badgeTextDanger: {
      color: '#b32626',
    },
    buttonBase: {
      minHeight: 44,
      minWidth: 44,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 999,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    buttonPrimary: {
      backgroundColor: palette.primary,
      borderColor: palette.primary,
    },
    buttonSecondary: {
      backgroundColor: palette.secondary,
      borderColor: palette.border,
    },
    buttonCompact: {
      minHeight: 36,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    buttonDisabled: {
      opacity: 0.55,
    },
    buttonText: {
      fontSize: 14,
      fontWeight: '600',
    },
    buttonPrimaryText: {
      color: palette.primaryText,
    },
    buttonSecondaryText: {
      color: palette.secondaryText,
    },
    input: {
      borderWidth: 1,
      borderColor: palette.inputBorder,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      color: palette.inputText,
      backgroundColor: palette.inputBackground,
    },
  });
