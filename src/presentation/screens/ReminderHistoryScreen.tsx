import { StyleSheet, Switch, Text, View } from 'react-native';
import { useMemo } from 'react';

import { useReminderState } from '@/src/application/state/ReminderStateStore';
import type { ReminderItem } from '@/src/domain/models/reminders';
import {
  Inline,
  ScreenHeader,
  ScreenLayout,
  SectionCard,
} from '@/src/presentation/components/ScreenChrome';
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
    <ScreenLayout scrollable>
      <ScreenHeader
        title="Scheduled Reminders"
        subtitle="Toggle a reminder off to skip it. Regenerate from settings to refresh."
        onBack={onBack}
      />

      {isLoading ? (
        <SectionCard title="Loading schedule…" />
      ) : scheduled.length === 0 ? (
        <SectionCard
          title="No reminders scheduled"
          body="Refresh your account snapshot and regenerate."
        />
      ) : (
        scheduled.map((reminder) => (
          <SectionCard key={reminder.id}>
            <Inline justify="space-between" wrap={false} align="center">
              <Text style={styles.cardTitle}>{reminder.title}</Text>
              <Switch
                value={reminder.status === 'scheduled'}
                onValueChange={() => toggleReminder(reminder.id)}
                disabled={isLoading}
                trackColor={{ false: palette.border, true: palette.primary }}
                thumbColor={palette.surface}
              />
            </Inline>
            <Text style={styles.cardText}>{getReminderMeta(reminder)}</Text>
            <Text style={styles.cardText}>Remind at: {formatTimestamp(reminder.remindAt)}</Text>
            <Text style={styles.cardText}>Status: {reminder.status}</Text>
          </SectionCard>
        ))
      )}
    </ScreenLayout>
  );
}

const createStyles = (palette: AppPalette) =>
  StyleSheet.create({
    cardTitle: {
      flex: 1,
      fontSize: 14,
      fontWeight: '600',
      color: palette.text,
    },
    cardText: {
      fontSize: 13,
      color: palette.textSubtle,
    },
  });
