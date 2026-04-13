import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useActiveLibrary } from '@/src/application/state/ActiveLibraryStore';
import { useAccountSession } from '@/src/application/state/AccountSessionStore';

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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: '600',
  },
  subtitle: {
    marginTop: 6,
    fontSize: 14,
    opacity: 0.7,
  },
  card: {
    marginTop: 24,
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.12)',
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  cardBody: {
    marginTop: 8,
    fontSize: 16,
  },
  cardMeta: {
    marginTop: 6,
    fontSize: 12,
    opacity: 0.65,
  },
  primaryButton: {
    marginTop: 16,
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: '#111827',
  },
  primaryButtonText: {
    color: '#fff',
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
    borderColor: '#111827',
  },
  secondaryButtonText: {
    color: '#111827',
    fontSize: 13,
    fontWeight: '600',
  },
});
