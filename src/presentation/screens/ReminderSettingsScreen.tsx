import { StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';

import { useReminderPreferences } from '@/src/application/state/ReminderPreferencesStore';
import { useReminderState } from '@/src/application/state/ReminderStateStore';

type ReminderSettingsScreenProps = {
  onBack: () => void;
  onOpenHistory: () => void;
};

const formatTimestamp = (value?: string) => {
  if (!value) return 'Not generated yet';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Not generated yet';
  return parsed.toLocaleString();
};

export function ReminderSettingsScreen({ onBack, onOpenHistory }: ReminderSettingsScreenProps) {
  const { preferences, isLoading, updatePreferences } = useReminderPreferences();
  const { state, isLoading: isStateLoading, isGenerating, refreshSchedule } = useReminderState();

  const bumpValue = (value: number, delta: number, min: number, max: number) =>
    Math.min(Math.max(value + delta, min), max);

  const handleLoanDays = (delta: number) => {
    updatePreferences({
      loanDueLeadDays: bumpValue(preferences.loanDueLeadDays, delta, 0, 14),
    });
  };

  const handlePickupHours = (delta: number) => {
    updatePreferences({
      reservationPickupLeadHours: bumpValue(preferences.reservationPickupLeadHours, delta, 0, 72),
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Reminder Settings</Text>
      </View>
      <Text style={styles.subtitle}>Saved to this device</Text>
      <Text style={styles.body}>Tune the reminder cadence for your account.</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Schedule status</Text>
        <Text style={styles.cardText}>
          {isStateLoading
            ? 'Loading reminder schedule…'
            : `Last generated: ${formatTimestamp(state.lastGeneratedAt)}`}
        </Text>
        <Text style={styles.cardText}>
          {isStateLoading ? 'Scheduled reminders: --' : `Scheduled reminders: ${state.scheduled.length}`}
        </Text>
        <View style={styles.stepperRow}>
          <TouchableOpacity
            onPress={refreshSchedule}
            style={styles.stepperButton}
            disabled={isGenerating}
          >
            <Text style={styles.stepperLabel}>
              {isGenerating ? 'Regenerating…' : 'Regenerate schedule'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onOpenHistory} style={styles.stepperButton}>
            <Text style={styles.stepperLabel}>Open history</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.cardTitle}>Reminders enabled</Text>
          <Switch
            value={preferences.enabled}
            onValueChange={(value) => updatePreferences({ enabled: value })}
            disabled={isLoading}
          />
        </View>
        <Text style={styles.cardText}>
          {preferences.enabled ? 'Active' : 'Paused'} for loan due and pickup alerts.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Loan due lead time</Text>
        <Text style={styles.cardText}>{preferences.loanDueLeadDays} days before due</Text>
        <View style={styles.stepperRow}>
          <TouchableOpacity
            onPress={() => handleLoanDays(-1)}
            style={styles.stepperButton}
            disabled={isLoading}
          >
            <Text style={styles.stepperLabel}>-1 day</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleLoanDays(1)}
            style={styles.stepperButton}
            disabled={isLoading}
          >
            <Text style={styles.stepperLabel}>+1 day</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Pickup lead time</Text>
        <Text style={styles.cardText}>
          {preferences.reservationPickupLeadHours} hours before pickup deadline
        </Text>
        <View style={styles.stepperRow}>
          <TouchableOpacity
            onPress={() => handlePickupHours(-2)}
            style={styles.stepperButton}
            disabled={isLoading}
          >
            <Text style={styles.stepperLabel}>-2 hrs</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handlePickupHours(2)}
            style={styles.stepperButton}
            disabled={isLoading}
          >
            <Text style={styles.stepperLabel}>+2 hrs</Text>
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
    borderColor: 'rgba(0,0,0,0.12)',
  },
  backButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
  },
  subtitle: {
    marginTop: 6,
    fontSize: 14,
    opacity: 0.7,
  },
  body: {
    marginTop: 16,
    fontSize: 14,
    lineHeight: 20,
  },
  card: {
    marginTop: 20,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
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
  },
  cardText: {
    marginTop: 8,
    fontSize: 13,
    opacity: 0.75,
  },
  stepperRow: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 12,
  },
  stepperButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.12)',
  },
  stepperLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
});
