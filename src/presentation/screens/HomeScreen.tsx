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

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Discover</Text>
      <Text style={styles.subtitle}>Browse and save from your library</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Active library</Text>
        <Text style={styles.cardBody}>
          {isLoading ? 'Loading selection…' : activeLibrary?.title ?? 'No library selected yet'}
        </Text>
        {activeLibrary?.location ? (
          <Text style={styles.cardMeta}>
            {[activeLibrary.location.city, activeLibrary.location.state, activeLibrary.location.country]
              .filter(Boolean)
              .join(', ')}
          </Text>
        ) : null}
        <TouchableOpacity onPress={onPickLibrary} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>
            {activeLibrary ? 'Change library' : 'Choose a library'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Search the catalog</Text>
        <Text style={styles.cardBody}>
          {activeLibrary
            ? `Explore ${activeLibrary.title} holdings.`
            : 'Select a library to start searching.'}
        </Text>
        <TouchableOpacity onPress={onStartSearch} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Start search</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Library account</Text>
        <Text style={styles.cardBody}>{formatAccountStatus(status)}</Text>
        {identity ? (
          <Text style={styles.cardMeta}>
            {identity.username ? `${identity.username} · ` : ''}
            {identity.providerTitle}
          </Text>
        ) : null}
        <TouchableOpacity onPress={onOpenAccount} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Open account</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Reminders</Text>
        <Text style={styles.cardBody}>Manage your local reminder schedule.</Text>
        <View style={styles.buttonRow}>
          <TouchableOpacity onPress={onOpenReminderSettings} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Reminder settings</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onOpenReminderHistory} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Scheduled reminders</Text>
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
      fontSize: 26,
      fontWeight: '600',
      color: palette.text,
    },
    subtitle: {
      marginTop: 6,
      fontSize: 14,
      color: palette.textSubtle,
    },
    card: {
      marginTop: 24,
      padding: 18,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: palette.border,
      backgroundColor: palette.surface,
    },
    cardTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: palette.text,
    },
    cardBody: {
      marginTop: 8,
      fontSize: 16,
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
      fontWeight: '600',
    },
    buttonRow: {
      marginTop: 16,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    secondaryButton: {
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
  });
