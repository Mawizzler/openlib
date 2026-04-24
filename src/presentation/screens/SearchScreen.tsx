import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Keyboard,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { SearchFlowService } from '@/src/application/services/opac/SearchFlowService';
import { useActiveLibrary } from '@/src/application/state/ActiveLibraryStore';
import { useRecentSearches } from '@/src/application/state/RecentSearchesStore';
import { useReminderState } from '@/src/application/state/ReminderStateStore';
import type { OpacBriefRecord, OpacSearchResult } from '@/src/domain/models/opac';
import {
  Badge,
  Button,
  Card,
  Inline,
  Input,
  ScreenHeader,
  ScreenLayout,
  StateNotice,
} from '@/src/presentation/components/ScreenChrome';
import { useAppPalette, type AppPalette } from '@/src/presentation/theme/palette';

type AvailabilityTone = 'positive' | 'negative' | 'neutral';
type SearchStatus = 'idle' | 'loading' | 'success' | 'error';

type SearchScreenProps = {
  onBack: () => void;
  onPickLibrary: () => void;
  onShowDetails: (record: OpacBriefRecord, libraryId: string | null) => void;
};

const normalizeTitle = (title?: string) => {
  const trimmed = title?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : 'Untitled record';
};

const formatAuthors = (authors?: string[]) => {
  const normalized = (authors ?? []).map((author) => author.trim()).filter(Boolean);
  if (!normalized.length) return 'Unknown author';
  return normalized.join(', ');
};

const formatMediaLabel = (format?: string) => {
  const trimmed = format?.trim();
  if (!trimmed) return 'Item';
  const normalized = trimmed.replace(/_/g, ' ');
  return normalized[0].toUpperCase() + normalized.slice(1);
};

const formatPublicationMeta = (record: OpacBriefRecord) => {
  const parts: string[] = [];
  if (record.publishedYear) parts.push(`Published ${record.publishedYear}`);
  const publisher = record.publisher?.trim();
  if (publisher) parts.push(publisher);
  const language = record.language?.trim();
  if (language) parts.push(`Language: ${language}`);
  return parts.length > 0 ? parts.join(' · ') : 'Publication details unavailable';
};

const getAvailabilityBadge = (
  record: OpacBriefRecord,
): { label: string; tone: AvailabilityTone } | null => {
  const label = record.availabilityLabel?.trim();
  if (label) return { label, tone: 'neutral' };

  switch (record.availabilityStatus) {
    case 'available':
      return { label: 'Available', tone: 'positive' };
    case 'checked_out':
      return { label: 'Checked out', tone: 'negative' };
    case 'on_hold':
      return { label: 'On hold', tone: 'neutral' };
    case 'in_transit':
      return { label: 'In transit', tone: 'neutral' };
    default:
      return null;
  }
};

export function SearchScreen({ onBack, onPickLibrary, onShowDetails }: SearchScreenProps) {
  const { activeLibrary, isLoading } = useActiveLibrary();
  const { createManualReminder } = useReminderState();
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [status, setStatus] = useState<SearchStatus>('idle');
  const [results, setResults] = useState<OpacSearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { recentSearches, addSearch, clearSearches } = useRecentSearches();
  const palette = useAppPalette();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const searchService = useMemo(() => new SearchFlowService(), []);

  const canSearch = Boolean(activeLibrary) && !isLoading;

  const submitQuery = async (input: string) => {
    if (!canSearch) {
      onPickLibrary();
      return;
    }

    const trimmed = input.trim();
    setQuery(trimmed);
    setSubmittedQuery(trimmed);
    if (!trimmed) {
      setResults(null);
      setStatus('idle');
      setError(null);
      return;
    }

    setStatus('loading');
    setError(null);
    try {
      const response = await searchService.search(activeLibrary!, { query: trimmed, page: 1 });
      setResults(response);
      setStatus('success');
      addSearch(trimmed);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Search failed. Try again.';
      setError(message);
      setStatus('error');
    }
  };

  const handleSubmit = async (input?: string) => {
    await submitQuery(input ?? query);
    Keyboard.dismiss();
  };

  const handleRecentSelect = async (recentQuery: string) => {
    await submitQuery(recentQuery);
  };

  const scheduleQuickReminder = (record: OpacBriefRecord, hoursFromNow: number) => {
    const remindAt = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
    createManualReminder({
      recordId: record.id,
      title: record.title || 'Untitled record',
      remindAt,
    });
  };

  const renderResult = ({ item }: { item: OpacBriefRecord }) => {
    const title = normalizeTitle(item.title);
    const authors = formatAuthors(item.authors);
    const publicationMeta = formatPublicationMeta(item);
    const mediaLabel = formatMediaLabel(item.mediaType || item.format);
    const availability = getAvailabilityBadge(item);

    return (
      <Card style={styles.resultCard}>
        <View style={styles.resultTopRow}>
          {item.coverImageUrl ? <Image source={{ uri: item.coverImageUrl }} style={styles.coverImage} /> : null}
          <View style={styles.resultContent}>
            <Text style={styles.resultTitle}>{title}</Text>
            <Text style={styles.resultAuthors}>{authors}</Text>
            <Text style={styles.resultMeta}>{mediaLabel}</Text>
            <Text style={styles.resultMeta}>{publicationMeta}</Text>
            {availability ? (
              <Badge
                label={availability.label}
                tone={
                  availability.tone === 'positive'
                    ? 'success'
                    : availability.tone === 'negative'
                      ? 'danger'
                      : 'neutral'
                }
              />
            ) : null}
          </View>
        </View>
        <Inline style={styles.resultActions}>
          <Button
            label="Details"
            onPress={() => onShowDetails(item, activeLibrary?.id ?? null)}
            variant="secondary"
          />
          <Button
            label="Remind in 24h"
            onPress={() => scheduleQuickReminder(item, 24)}
            variant="secondary"
          />
        </Inline>
      </Card>
    );
  };

  const resultCount = results?.records.length ?? 0;

  return (
    <ScreenLayout scrollable contentStyle={styles.scrollContent}>
      <ScreenHeader
        title="Search"
        subtitle={activeLibrary ? activeLibrary.title : 'Choose a library to search its catalog.'}
        onBack={onBack}
      />

      <Card>
        <Input
          value={query}
          onChangeText={setQuery}
          placeholder="Search by title, author, or keyword"
          returnKeyType="search"
          onSubmitEditing={() => handleSubmit()}
        />
        <Inline style={styles.searchActions}>
          <Button
            label={canSearch ? 'Search' : 'Choose library first'}
            onPress={() => handleSubmit()}
            variant="primary"
            disabled={status === 'loading'}
          />
          {recentSearches.length > 0 ? (
            <Button label="Clear recent" onPress={clearSearches} variant="secondary" />
          ) : null}
        </Inline>

        {status === 'loading' ? (
          <Inline style={styles.loadingRow}>
            <ActivityIndicator size="small" color={palette.primary} />
            <Text style={styles.loadingText}>Searching {activeLibrary?.title}…</Text>
          </Inline>
        ) : null}

        {error ? <StateNotice message={error} tone="error" /> : null}

        {recentSearches.length > 0 ? (
          <View>
            <Text style={styles.sectionLabel}>Recent searches</Text>
            <Inline style={styles.recentList}>
              {recentSearches.map((recentQuery) => (
                <Button
                  key={recentQuery}
                  label={recentQuery}
                  onPress={() => handleRecentSelect(recentQuery)}
                  variant="secondary"
                  compact
                />
              ))}
            </Inline>
          </View>
        ) : null}
      </Card>

      {status === 'success' ? (
        <Card
          title={resultCount > 0 ? `${resultCount} result${resultCount === 1 ? '' : 's'}` : 'No results'}
          body={
            resultCount > 0
              ? `Showing matches for “${submittedQuery}”.`
              : `No matches found for “${submittedQuery}”. Try another search.`
          }
        >
          {resultCount > 0 ? (
            <FlatList
              data={results?.records ?? []}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              contentContainerStyle={styles.resultsList}
              renderItem={renderResult}
            />
          ) : null}
        </Card>
      ) : null}
    </ScreenLayout>
  );
}

const createStyles = (palette: AppPalette) =>
  StyleSheet.create({
    scrollContent: {
      paddingBottom: 48,
    },
    searchActions: {
      marginTop: 12,
    },
    loadingRow: {
      marginTop: 12,
    },
    loadingText: {
      fontSize: 14,
      color: palette.textSubtle,
    },
    sectionLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: palette.textMuted,
    },
    recentList: {
      marginTop: 12,
    },
    resultsList: {
      paddingTop: 4,
      gap: 12,
    },
    resultCard: {
      marginTop: 0,
    },
    resultTopRow: {
      flexDirection: 'row',
      gap: 14,
      alignItems: 'flex-start',
    },
    coverImage: {
      width: 72,
      height: 108,
      borderRadius: 10,
      backgroundColor: palette.surfaceMuted,
    },
    resultContent: {
      flex: 1,
      gap: 6,
    },
    resultTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: palette.text,
    },
    resultAuthors: {
      fontSize: 14,
      color: palette.textSubtle,
    },
    resultMeta: {
      fontSize: 12,
      color: palette.textMuted,
    },
    resultActions: {
      marginTop: 4,
    },
  });
