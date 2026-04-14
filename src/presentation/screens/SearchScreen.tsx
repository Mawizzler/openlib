import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useMemo, useState } from 'react';

import { useActiveLibrary } from '@/src/application/state/ActiveLibraryStore';
import { useRecentSearches } from '@/src/application/state/RecentSearchesStore';
import { useReminderState } from '@/src/application/state/ReminderStateStore';
import { SearchFlowService } from '@/src/application/services/opac/SearchFlowService';
import type { OpacBriefRecord, OpacSearchResult } from '@/src/domain/models/opac';
import { useAppPalette, type AppPalette } from '@/src/presentation/theme/palette';

const formatAuthors = (authors: string[]) => {
  if (!authors.length) return 'Unknown author';
  return authors.join(', ');
};

type SearchScreenProps = {
  onBack: () => void;
  onPickLibrary: () => void;
  onShowDetails: (record: OpacBriefRecord, libraryId: string | null) => void;
};

type SearchStatus = 'idle' | 'loading' | 'success' | 'error';

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
      const response = await searchService.search(activeLibrary!, {
        query: trimmed,
        page: 1,
      });
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
    return (
      <View style={styles.resultCard}>
        <TouchableOpacity
          style={styles.resultMain}
          onPress={() => onShowDetails(item, activeLibrary?.id ?? null)}
        >
          <Text style={styles.resultTitle}>{item.title || 'Untitled'}</Text>
          <Text style={styles.resultMeta}>{formatAuthors(item.authors)}</Text>
          {item.publishedYear || item.format ? (
            <Text style={styles.resultMeta}>
              {[item.format, item.publishedYear].filter(Boolean).join(' · ')}
            </Text>
          ) : null}
        </TouchableOpacity>
        <View style={styles.resultActions}>
          <TouchableOpacity
            onPress={() => scheduleQuickReminder(item, 24)}
            style={styles.resultActionButton}
          >
            <Text style={styles.resultActionText}>Remind tomorrow</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const listEmpty = () => {
    if (status === 'loading') return null;
    if (status === 'error') {
      return (
        <View style={styles.stateCard}>
          <Text style={styles.stateTitle}>Search error</Text>
          <Text style={styles.stateBody}>{error ?? 'Something went wrong.'}</Text>
        </View>
      );
    }
    if (!canSearch && !isLoading) {
      return (
        <View style={styles.stateCard}>
          <Text style={styles.stateTitle}>Select a library to search</Text>
          <Text style={styles.stateBody}>Pick a library above to see available titles.</Text>
        </View>
      );
    }
    if (status === 'success' && results && results.records.length === 0) {
      return (
        <View style={styles.stateCard}>
          <Text style={styles.stateTitle}>No matches found</Text>
          <Text style={styles.stateBody}>
            {submittedQuery
              ? `No results for “${submittedQuery}”. Try a shorter title or author name.`
              : 'Try a broader title, author, or keyword.'}
          </Text>
        </View>
      );
    }
    if (recentSearches.length > 0) {
      return (
        <View style={styles.stateCard}>
          <View style={styles.recentHeader}>
            <Text style={styles.stateTitle}>Recent searches</Text>
            <TouchableOpacity onPress={clearSearches} style={styles.clearButton}>
              <Text style={styles.clearButtonText}>Clear</Text>
            </TouchableOpacity>
          </View>
          {recentSearches.map((entry) => (
            <TouchableOpacity
              key={`${entry.query}-${entry.searchedAt}`}
              onPress={() => handleRecentSelect(entry.query)}
              style={styles.recentChip}
            >
              <Text style={styles.recentChipText}>{entry.query}</Text>
            </TouchableOpacity>
          ))}
        </View>
      );
    }

    return (
      <View style={styles.stateCard}>
        <Text style={styles.stateTitle}>Search your library</Text>
        <Text style={styles.stateBody}>Enter a title, author, or keyword to begin.</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Search</Text>
      </View>

      <View style={styles.libraryCard}>
        <Text style={styles.cardTitle}>Active library</Text>
        <Text style={styles.cardBody}>
          {isLoading
            ? 'Loading selection…'
            : activeLibrary?.title ?? 'No library selected yet'}
        </Text>
        {!activeLibrary && !isLoading ? (
          <TouchableOpacity onPress={onPickLibrary} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Choose a library</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.searchRow}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={canSearch ? 'Search by title, author, or keyword' : 'Select a library first'}
          placeholderTextColor={palette.inputPlaceholder}
          style={[styles.searchInput, !canSearch && styles.searchInputDisabled]}
          editable={canSearch}
          returnKeyType="search"
          onSubmitEditing={(event) => handleSubmit(event.nativeEvent.text)}
        />
        <TouchableOpacity
          onPress={() => handleSubmit()}
          style={[styles.primaryButton, !canSearch && styles.primaryButtonDisabled]}
          disabled={!canSearch}
        >
          <Text style={styles.primaryButtonText}>Search</Text>
        </TouchableOpacity>
      </View>

      {status === 'loading' ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={palette.primary} />
          <Text style={styles.loadingText}>Searching {activeLibrary?.title ?? 'library'}…</Text>
        </View>
      ) : null}

      <FlatList
        data={results?.records ?? []}
        keyExtractor={(item) => item.id}
        renderItem={renderResult}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={listEmpty}
      />
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
    libraryCard: {
      padding: 16,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: palette.border,
      backgroundColor: palette.surface,
      marginBottom: 16,
    },
    cardTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: palette.text,
    },
    cardBody: {
      marginTop: 6,
      fontSize: 15,
      color: palette.textMuted,
    },
    secondaryButton: {
      marginTop: 12,
      alignSelf: 'flex-start',
      paddingVertical: 8,
      paddingHorizontal: 14,
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
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 12,
    },
    searchInput: {
      flex: 1,
      borderWidth: 1,
      borderColor: palette.inputBorder,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 10,
      fontSize: 14,
      backgroundColor: palette.inputBackground,
      color: palette.inputText,
    },
    searchInputDisabled: {
      backgroundColor: palette.surfaceMuted,
      color: palette.textSubtle,
    },
    primaryButton: {
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 999,
      backgroundColor: palette.primary,
    },
    primaryButtonDisabled: {
      opacity: 0.55,
    },
    primaryButtonText: {
      color: palette.primaryText,
      fontSize: 12,
      fontWeight: '600',
    },
    loadingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 8,
    },
    loadingText: {
      fontSize: 12,
      color: palette.textSubtle,
    },
    listContent: {
      paddingBottom: 24,
    },
    resultCard: {
      padding: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: palette.border,
      backgroundColor: palette.surface,
      marginBottom: 10,
    },
    resultMain: {
      gap: 4,
    },
    resultActions: {
      marginTop: 10,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    resultActionButton: {
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: palette.border,
      backgroundColor: palette.secondary,
    },
    resultActionText: {
      fontSize: 11,
      fontWeight: '600',
      color: palette.secondaryText,
    },
    resultTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: palette.text,
    },
    resultMeta: {
      marginTop: 4,
      fontSize: 12,
      color: palette.textSubtle,
    },
    stateCard: {
      paddingVertical: 32,
      alignItems: 'center',
    },
    recentHeader: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    clearButton: {
      paddingVertical: 4,
      paddingHorizontal: 10,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: palette.border,
      backgroundColor: palette.secondary,
    },
    clearButtonText: {
      fontSize: 11,
      fontWeight: '600',
      color: palette.secondaryText,
    },
    recentChip: {
      alignSelf: 'stretch',
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: palette.border,
      backgroundColor: palette.surface,
      marginBottom: 10,
    },
    recentChipText: {
      fontSize: 13,
      fontWeight: '500',
      color: palette.text,
    },
    stateTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: palette.text,
      textAlign: 'center',
    },
    stateBody: {
      marginTop: 6,
      fontSize: 12,
      color: palette.textSubtle,
      textAlign: 'center',
    },
  });
