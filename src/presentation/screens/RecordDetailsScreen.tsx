import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, Switch, Text, View } from 'react-native';

import { RecordDetailsFlowService } from '@/src/application/services/opac/RecordDetailsFlowService';
import { useActiveLibrary } from '@/src/application/state/ActiveLibraryStore';
import { useReminderState } from '@/src/application/state/ReminderStateStore';
import type { OpacAvailability, OpacBriefRecord, OpacIdentifier, OpacRecord } from '@/src/domain/models/opac';
import { providersRegistryRepository } from '@/src/infrastructure/providers/ProvidersRegistryRepository';
import {
  Badge,
  Button,
  Inline,
  ScreenHeader,
  ScreenLayout,
  SectionCard,
  StateNotice,
  Stack,
} from '@/src/presentation/components/ScreenChrome';
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

const formatIdentifier = (identifier: OpacIdentifier) =>
  `${identifier.system.toUpperCase()}: ${identifier.value}`;

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
    <ScreenLayout scrollable contentStyle={styles.content}>
      <ScreenHeader
        title="Record"
        subtitle={provider?.title ?? 'Record details'}
        onBack={onBack}
      />

      {status === 'loading' ? (
        <Inline style={styles.loadingRow}>
          <ActivityIndicator size="small" color={palette.primary} />
          <Text style={styles.loadingText}>
            Loading full details{provider?.title ? ` from ${provider.title}` : ''}…
          </Text>
        </Inline>
      ) : null}

      {status === 'error' ? (
        <SectionCard title="Details unavailable">
          <StateNotice message={error ?? 'Unable to load details.'} tone="error" />
          <Button label="Retry" onPress={fetchDetails} variant="secondary" />
        </SectionCard>
      ) : null}

      <SectionCard
        title={displayRecord.title || 'Untitled record'}
        body={formatAuthors(displayRecord.authors ?? [])}
        meta={displayRecord.publisher || displayRecord.publishedYear?.toString()}
      >
        <Inline>
          {displayRecord.mediaType || displayRecord.format ? (
            <Badge label={displayRecord.mediaType || displayRecord.format || 'Item'} />
          ) : null}
          {availability ? <Badge label={formatAvailability(availability)} tone="success" /> : null}
        </Inline>
        {displayRecord.description ? <Text style={styles.bodyText}>{displayRecord.description}</Text> : null}
        {detailLink ? (
          <Button label="Open in catalog" onPress={() => Linking.openURL(detailLink)} variant="secondary" />
        ) : null}
      </SectionCard>

      {displayRecord.identifiers?.length ? (
        <SectionCard title="Identifiers">
          <Stack gap={8}>
            {displayRecord.identifiers.map((identifier) => (
              <Text key={`${identifier.system}:${identifier.value}`} style={styles.metaText}>
                {formatIdentifier(identifier)}
              </Text>
            ))}
          </Stack>
        </SectionCard>
      ) : null}

      <SectionCard title="Manual reminders" body="Create a quick reminder for this record.">
        <Inline>
          <Button label="In 4h" onPress={() => scheduleManualReminder(4)} variant="secondary" compact />
          <Button label="In 24h" onPress={() => scheduleManualReminder(24)} variant="secondary" compact />
          <Button label="In 72h" onPress={() => scheduleManualReminder(72)} variant="secondary" compact />
        </Inline>
        {manualReminders.length ? (
          <Stack gap={10}>
            {manualReminders.map((reminder) => (
              <Inline key={reminder.id} justify="space-between" wrap={false} align="center" style={styles.reminderRow}>
                <View style={styles.reminderCopy}>
                  <Text style={styles.metaText}>Remind at: {formatTimestamp(reminder.remindAt)}</Text>
                  <Text style={styles.metaText}>Status: {reminder.status}</Text>
                </View>
                <Switch
                  value={reminder.status === 'scheduled'}
                  onValueChange={() => toggleReminder(reminder.id)}
                  trackColor={{ false: palette.border, true: palette.primary }}
                  thumbColor={palette.surface}
                />
              </Inline>
            ))}
          </Stack>
        ) : (
          <Text style={styles.metaText}>No manual reminders scheduled yet.</Text>
        )}
      </SectionCard>
    </ScreenLayout>
  );
}

const createStyles = (palette: AppPalette) =>
  StyleSheet.create({
    content: {
      paddingBottom: 32,
    },
    loadingRow: {
      marginTop: -8,
    },
    loadingText: {
      fontSize: 14,
      color: palette.textSubtle,
    },
    bodyText: {
      fontSize: 14,
      lineHeight: 20,
      color: palette.textSubtle,
    },
    metaText: {
      fontSize: 13,
      color: palette.textMuted,
    },
    reminderRow: {
      paddingTop: 4,
    },
    reminderCopy: {
      flex: 1,
      gap: 6,
    },
  });
