import { StyleSheet, Switch, Text } from 'react-native';
import { useMemo } from 'react';

import { useReminderPreferences } from '@/src/application/state/ReminderPreferencesStore';
import { useReminderState } from '@/src/application/state/ReminderStateStore';
import {
  Button,
  Inline,
  ScreenHeader,
  ScreenLayout,
  SectionCard,
} from '@/src/presentation/components/ScreenChrome';
import { useAppPalette, type AppPalette } from '@/src/presentation/theme/palette';

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
  const palette = useAppPalette();
  const styles = useMemo(() => createStyles(palette), [palette]);

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
    <ScreenLayout scrollable>
      <ScreenHeader
        title="Reminder Settings"
        subtitle="Saved to this device"
        onBack={onBack}
      />

      <SectionCard
        title="Schedule status"
        body="Tune the reminder cadence for your account."
        footer={
          <Inline>
            <Button
              label={isGenerating ? 'Regenerating…' : 'Regenerate schedule'}
              onPress={refreshSchedule}
              variant="secondary"
              disabled={isGenerating}
            />
            <Button label="Open history" onPress={onOpenHistory} variant="secondary" />
          </Inline>
        }
      >
        <Text style={styles.cardText}>
          {isStateLoading
            ? 'Loading reminder schedule…'
            : `Last generated: ${formatTimestamp(state.lastGeneratedAt)}`}
        </Text>
        <Text style={styles.cardText}>
          {isStateLoading ? 'Scheduled reminders: --' : `Scheduled reminders: ${state.scheduled.length}`}
        </Text>
      </SectionCard>

      <SectionCard title="Reminders enabled">
        <Inline justify="space-between" wrap={false} align="center">
          <Text style={styles.cardText}>
            {preferences.enabled ? 'Active' : 'Paused'} for loan due and pickup alerts.
          </Text>
          <Switch
            value={preferences.enabled}
            onValueChange={(value) => updatePreferences({ enabled: value })}
            disabled={isLoading}
            trackColor={{ false: palette.border, true: palette.primary }}
            thumbColor={palette.surface}
          />
        </Inline>
      </SectionCard>

      <SectionCard title="Loan due lead time" body={`${preferences.loanDueLeadDays} days before due`}>
        <Inline>
          <Button label="-1 day" onPress={() => handleLoanDays(-1)} variant="secondary" disabled={isLoading} compact />
          <Button label="+1 day" onPress={() => handleLoanDays(1)} variant="secondary" disabled={isLoading} compact />
        </Inline>
      </SectionCard>

      <SectionCard
        title="Pickup lead time"
        body={`${preferences.reservationPickupLeadHours} hours before pickup deadline`}
      >
        <Inline>
          <Button label="-2 hrs" onPress={() => handlePickupHours(-2)} variant="secondary" disabled={isLoading} compact />
          <Button label="+2 hrs" onPress={() => handlePickupHours(2)} variant="secondary" disabled={isLoading} compact />
        </Inline>
      </SectionCard>
    </ScreenLayout>
  );
}

const createStyles = (palette: AppPalette) =>
  StyleSheet.create({
    cardText: {
      fontSize: 13,
      color: palette.textSubtle,
    },
  });
