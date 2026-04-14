import { StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useMemo } from 'react';

import { useReminderState } from '@/src/application/state/ReminderStateStore';
import type { ReminderItem } from '@/src/domain/models/reminders';
import { useAppPalette, type AppPalette } from '@/src/presentation/theme/palette';

type ReminderHistoryScreenProps = {
  onBack: () => void;
};

const formatTimestamp = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
};

const getReminderMeta = (reminder: ReminderItem) => {
  if (reminder.kind === 'loan_due') {
    return `Due: ${formatTimestamp(reminder.dueDate)}`;
  }
  if (reminder.kind === 'reservation_pickup') {
    return `Pickup by: ${formatTimestamp(reminder.pickupByDate)}`;
  }
  return `Manual reminder · Record ID: ${reminder.recordId}`;
};

export function ReminderHistoryScreen({ onBack }: ReminderHistoryScreenProps) {
  const { state, isLoading, toggleReminder } = useReminderState();
  const scheduled = state.scheduled;
  const palette = useAppPalette();
  const styles = useMemo(() => createStyles(palette), [palette]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Scheduled Reminders</Text>
      </View>
      <Text style={styles.subtitle}>Local schedule</Text>
      <Text style={styles.body}>
        Toggle a reminder off to skip it. Regenerate from settings to refresh.
      </Text>

      {isLoading ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Loading schedule…</Text>
        </View>
      ) : scheduled.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>No reminders scheduled</Text>
          <Text style={styles.cardText}>Refresh your account snapshot and regenerate.</Text>
        </View>
      ) : (
        scheduled.map((reminder) => (
          <View key={reminder.id} style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.cardTitle}>{reminder.title}</Text>
              <Switch
                value={reminder.status === 'scheduled'}
                onValueChange={() => toggleReminder(reminder.id)}
                disabled={isLoading}
                trackColor={{ false: palette.border, true: palette.primary }}
                thumbColor={palette.surface}
              />
            </View>
            <Text style={styles.cardText}>{getReminderMeta(reminder)}</Text>
            <Text style={styles.cardText}>Remind at: {formatTimestamp(reminder.remindAt)}</Text>
            <Text style={styles.cardText}>Status: {reminder.status}</Text>
          </View>
        ))
      )}
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
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    backButton: {
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: palette.border,
      backgroundColor: palette.surface,
    },
    backButtonText: {
      fontSize: 12,
      fontWeight: '600',
      color: palette.text,
    },
    title: {
      fontSize: 24,
      fontWeight: '600',
      color: palette.text,
    },
    subtitle: {
      marginTop: 6,
      fontSize: 14,
      color: palette.textSubtle,
    },
    body: {
      marginTop: 16,
      fontSize: 14,
      lineHeight: 20,
      color: palette.textMuted,
    },
    card: {
      marginTop: 20,
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: palette.border,
      backgroundColor: palette.surface,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    cardTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: palette.text,
    },
    cardText: {
      marginTop: 8,
      fontSize: 13,
      color: palette.textSubtle,
    },
  });
