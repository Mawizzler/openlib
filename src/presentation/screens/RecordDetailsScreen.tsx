import {
  ActivityIndicator,
  Linking,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useActiveLibrary } from '@/src/application/state/ActiveLibraryStore';
import { useReminderState } from '@/src/application/state/ReminderStateStore';
import { RecordDetailsFlowService } from '@/src/application/services/opac/RecordDetailsFlowService';
import type { OpacAvailability, OpacBriefRecord, OpacIdentifier, OpacRecord } from '@/src/domain/models/opac';
import { providersRegistryRepository } from '@/src/infrastructure/providers/ProvidersRegistryRepository';
import { useAppPalette, type AppPalette } from '@/src/presentation/theme/palette';

type RecordDetailsScreenProps = {
  record: OpacBriefRecord;
  libraryId?: string;
  onBack: () => void;
};

type DetailStatus = 'idle' | 'loading' | 'success' | 'error';

const findDetailLink = (record: OpacBriefRecord | OpacRecord) => {
  if (record.detailUrl) return record.detailUrl;
  const legacy = record.identifiers?.find((id) => id.system === 'local')?.value;
  if (legacy && (legacy.startsWith('http://') || legacy.startsWith('https://'))) {
    return legacy;
  }
  return undefined;
};

const formatAuthors = (authors: string[]) => {
  if (!authors.length) return 'Unknown author';
  return authors.join(', ');
};

const formatAvailability = (availability: OpacAvailability) => {
  if (availability.totalCount === 0) {
    return 'Availability data not available yet.';
  }
  return `${availability.availableCount} of ${availability.totalCount} available`;
};

const formatTimestamp = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
};

export function RecordDetailsScreen({ record, libraryId, onBack }: RecordDetailsScreenProps) {
  const { activeLibrary, isLoading: isLibraryLoading } = useActiveLibrary();
  const { state: reminderState, createManualReminder, toggleReminder } = useReminderState();
  const palette = useAppPalette();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const provider = useMemo(() => {
    if (libraryId) {
      return providersRegistryRepository.getProviderById(libraryId) ?? activeLibrary;
    }
    return activeLibrary;
  }, [activeLibrary, libraryId]);
  const detailsService = useMemo(() => new RecordDetailsFlowService(), []);
  const [status, setStatus] = useState<DetailStatus>('idle');
  const [details, setDetails] = useState<OpacRecord | null>(null);
  const [availability, setAvailability] = useState<OpacAvailability | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchDetails = useCallback(async () => {
    if (!provider) {
      setStatus('error');
      setError('Select a library to load full record details.');
      return;
    }

    setStatus('loading');
    setError(null);
    try {
      const response = await detailsService.fetchDetails(provider, record);
      setDetails(response.record);
      setAvailability(response.availability);
      setStatus('success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load details.';
      setError(message);
      setStatus('error');
    }
  }, [detailsService, provider, record]);

  useEffect(() => {
    if (isLibraryLoading) return;
    fetchDetails();
  }, [fetchDetails, isLibraryLoading]);

  const displayRecord = (details ?? record) as OpacRecord;
  const detailLink = findDetailLink(displayRecord);
  const manualReminders = reminderState.scheduled.filter(
    (item) => item.kind === 'manual' && item.recordId === displayRecord.id,
  );

  const scheduleManualReminder = (hoursFromNow: number) => {
    const remindAt = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
    createManualReminder({
      recordId: displayRecord.id,
      title: displayRecord.title || 'Untitled record',
      remindAt,
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Record</Text>
      </View>

      {status === 'loading' ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={palette.primary} />
          <Text style={styles.loadingText}>
            Loading full details{provider?.title ? ` from ${provider.title}` : ''}…
          </Text>
        </View>
      ) : null}

      {status === 'error' ? (
        <View style={styles.stateCard}>
          <Text style={styles.stateTitle}>Details unavailable</Text>
          <Text style={styles.stateBody}>{error ?? 'Unable to load details.'}</Text>
          <TouchableOpacity onPress={fetchDetails} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{displayRecord.title || 'Untitled record'}</Text>
        <Text style={styles.cardBody}>ID: {displayRecord.id}</Text>
        <Text style={styles.cardBody}>Authors: {formatAuthors(displayRecord.authors)}</Text>
        {displayRecord.publishedYear || displayRecord.format ? (
          <Text style={styles.cardBody}>
            {[displayRecord.format, displayRecord.publishedYear].filter(Boolean).join(' · ')}
          </Text>
        ) : null}
        {displayRecord.publisher ? (
          <Text style={styles.cardBody}>Publisher: {displayRecord.publisher}</Text>
        ) : null}
        {displayRecord.language ? (
          <Text style={styles.cardBody}>Language: {displayRecord.language}</Text>
        ) : null}
        {displayRecord.description ? (
          <Text style={styles.cardMeta}>{displayRecord.description}</Text>
        ) : null}
        {availability ? (
          <Text style={styles.cardMeta}>{formatAvailability(availability)}</Text>
        ) : null}
        {detailLink ? (
          <TouchableOpacity
            onPress={() => Linking.openURL(detailLink)}
            style={styles.linkButton}
          >
            <Text style={styles.linkButtonText}>Open detail link</Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.cardMeta}>No detail link available.</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Reminders for this record</Text>
        <Text style={styles.cardMeta}>Create a local reminder from this title.</Text>
        <View style={styles.reminderActions}>
          <TouchableOpacity
            onPress={() => scheduleManualReminder(24)}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>Tomorrow</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => scheduleManualReminder(24 * 7)}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>Next week</Text>
          </TouchableOpacity>
        </View>

        {manualReminders.length === 0 ? (
          <Text style={styles.cardMeta}>No reminders yet.</Text>
        ) : (
          manualReminders.map((reminder) => (
            <View key={reminder.id} style={styles.reminderRow}>
              <View style={styles.reminderText}>
                <Text style={styles.cardBody}>Remind at {formatTimestamp(reminder.remindAt)}</Text>
                <Text style={styles.cardMeta}>Status: {reminder.status}</Text>
              </View>
              <Switch
                value={reminder.status === 'scheduled'}
                onValueChange={() => toggleReminder(reminder.id)}
                trackColor={{ false: palette.border, true: palette.primary }}
                thumbColor={palette.surface}
              />
            </View>
          ))
        )}
      </View>
    </View>
  );
}

const createStyles = (palette: AppPalette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      paddingHorizontal: 20,
      paddingTop: 16,
      backgroundColor: palette.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 16,
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
      fontSize: 20,
      fontWeight: '600',
      color: palette.text,
    },
    loadingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 12,
    },
    loadingText: {
      fontSize: 12,
      color: palette.textSubtle,
    },
    stateCard: {
      padding: 14,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: palette.border,
      backgroundColor: palette.surface,
      marginBottom: 12,
    },
    stateTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: palette.text,
    },
    stateBody: {
      marginTop: 6,
      fontSize: 12,
      color: palette.textSubtle,
    },
    secondaryButton: {
      marginTop: 10,
      alignSelf: 'flex-start',
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: palette.border,
      backgroundColor: palette.secondary,
    },
    secondaryButtonText: {
      fontSize: 12,
      fontWeight: '600',
      color: palette.secondaryText,
    },
    card: {
      padding: 18,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: palette.border,
      backgroundColor: palette.surface,
      marginBottom: 14,
    },
    cardTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: palette.text,
    },
    cardBody: {
      marginTop: 10,
      fontSize: 14,
      color: palette.textMuted,
    },
    cardMeta: {
      marginTop: 12,
      fontSize: 12,
      color: palette.textSubtle,
    },
    reminderActions: {
      marginTop: 12,
      flexDirection: 'row',
      gap: 10,
      flexWrap: 'wrap',
    },
    reminderRow: {
      marginTop: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    reminderText: {
      flex: 1,
    },
    linkButton: {
      marginTop: 14,
      alignSelf: 'flex-start',
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 999,
      backgroundColor: palette.primary,
    },
    linkButtonText: {
      color: palette.primaryText,
      fontSize: 12,
      fontWeight: '600',
    },
  });
