import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useMemo } from 'react';

import { useActiveLibrary } from '@/src/application/state/ActiveLibraryStore';
import { useAccountSession } from '@/src/application/state/AccountSessionStore';
import { useAppPalette, type AppPalette } from '@/src/presentation/theme/palette';

type HomeScreenProps = {
  onPickLibrary: () => void;
  onStartSearch: () => void;
  onOpenAccount: () => void;
  onOpenReminderSettings: () => void;
  onOpenReminderHistory: () => void;
};

const formatAccountStatus = (status: string) => {
  switch (status) {
    case 'logged_in':
      return 'Signed in (scaffold)';
    case 'logging_in':
      return 'Signing in…';
    case 'error':
      return 'Sign-in error';
    default:
      return 'Signed out';
  }
};

export function HomeScreen({
  onPickLibrary,
  onStartSearch,
  onOpenAccount,
  onOpenReminderSettings,
  onOpenReminderHistory,
}: HomeScreenProps) {
  const { activeLibrary, isLoading } = useActiveLibrary();
  const { status, identity } = useAccountSession();
  const palette = useAppPalette();
  const styles = useMemo(() => createStyles(palette), [palette]);

  const hasLibrary = Boolean(activeLibrary) && !isLoading;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Openlib</Text>
      <Text style={styles.subtitle}>Find books, manage your account, and stay ahead of due dates.</Text>

      <View style={styles.heroCard}>
        <Text style={styles.heroEyebrow}>{hasLibrary ? 'Ready to search' : 'First step required'}</Text>
        <Text style={styles.heroTitle}>
          {hasLibrary ? `Using ${activeLibrary?.title}` : 'Choose your library to unlock the app'}
        </Text>
        <Text style={styles.heroBody}>
          {hasLibrary
            ? 'Search, account, and reminders are now enabled.'
            : 'Openlib is library-first: select one library, then continue to search and account features.'}
        </Text>
        <TouchableOpacity onPress={onPickLibrary} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>{hasLibrary ? 'Change library' : 'Choose a library'}</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.card, !hasLibrary && styles.cardLocked]}>
        <Text style={styles.cardTitle}>1) Search the catalog</Text>
        <Text style={styles.cardBody}>
          {hasLibrary
            ? `Explore ${activeLibrary?.title} holdings.`
            : 'Locked until a library is selected.'}
        </Text>
        <TouchableOpacity
          onPress={hasLibrary ? onStartSearch : onPickLibrary}
          style={[styles.secondaryButton, !hasLibrary && styles.buttonLocked]}
        >
          <Text style={styles.secondaryButtonText}>{hasLibrary ? 'Start search' : 'Choose library first'}</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.card, !hasLibrary && styles.cardLocked]}>
        <Text style={styles.cardTitle}>2) Connect your account</Text>
        <Text style={styles.cardBody}>{formatAccountStatus(status)}</Text>
        {identity ? (
          <Text style={styles.cardMeta}>
            {identity.username ? `${identity.username} · ` : ''}
            {identity.providerTitle}
          </Text>
        ) : null}
        <TouchableOpacity
          onPress={hasLibrary ? onOpenAccount : onPickLibrary}
          style={[styles.secondaryButton, !hasLibrary && styles.buttonLocked]}
        >
          <Text style={styles.secondaryButtonText}>{hasLibrary ? 'Open account' : 'Choose library first'}</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.card, !hasLibrary && styles.cardLocked]}>
        <Text style={styles.cardTitle}>3) Set reminders</Text>
        <Text style={styles.cardBody}>Manage your local reminder schedule.</Text>
        <View style={styles.buttonRow}>
          <TouchableOpacity
            onPress={hasLibrary ? onOpenReminderSettings : onPickLibrary}
            style={[styles.secondaryButton, !hasLibrary && styles.buttonLocked]}
          >
            <Text style={styles.secondaryButtonText}>
              {hasLibrary ? 'Reminder settings' : 'Choose library first'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={hasLibrary ? onOpenReminderHistory : onPickLibrary}
            style={[styles.secondaryButton, !hasLibrary && styles.buttonLocked]}
          >
            <Text style={styles.secondaryButtonText}>
              {hasLibrary ? 'Scheduled reminders' : 'Choose library first'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const createStyles = (palette: AppPalette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      padding: 24,
      backgroundColor: palette.background,
    },
    title: {
      fontSize: 28,
      fontWeight: '700',
      color: palette.text,
    },
    subtitle: {
      marginTop: 8,
      fontSize: 14,
      color: palette.textSubtle,
    },
    heroCard: {
      marginTop: 20,
      padding: 18,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: palette.border,
      backgroundColor: palette.surface,
    },
    heroEyebrow: {
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 0.4,
      textTransform: 'uppercase',
      color: palette.textSubtle,
    },
    heroTitle: {
      marginTop: 8,
      fontSize: 20,
      fontWeight: '700',
      color: palette.text,
    },
    heroBody: {
      marginTop: 8,
      fontSize: 14,
      color: palette.textMuted,
    },
    card: {
      marginTop: 16,
      padding: 18,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: palette.border,
      backgroundColor: palette.surface,
    },
    cardLocked: {
      opacity: 0.95,
    },
    cardTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: palette.text,
    },
    cardBody: {
      marginTop: 8,
      fontSize: 15,
      color: palette.textMuted,
    },
    cardMeta: {
      marginTop: 6,
      fontSize: 12,
      color: palette.textSubtle,
    },
    primaryButton: {
      marginTop: 16,
      alignSelf: 'flex-start',
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 999,
      backgroundColor: palette.primary,
    },
    primaryButtonText: {
      color: palette.primaryText,
      fontSize: 13,
      fontWeight: '700',
    },
    secondaryButton: {
      marginTop: 14,
      alignSelf: 'flex-start',
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: palette.border,
      backgroundColor: palette.secondary,
    },
    secondaryButtonText: {
      color: palette.secondaryText,
      fontSize: 13,
      fontWeight: '600',
    },
    buttonLocked: {
      borderColor: palette.border,
      backgroundColor: palette.surfaceMuted,
    },
    buttonRow: {
      marginTop: 8,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
  });
