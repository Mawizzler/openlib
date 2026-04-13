import { FlatList, Keyboard, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useMemo, useState } from 'react';

import { useActiveLibrary } from '@/src/application/state/ActiveLibraryStore';
import { providersRegistryRepository } from '@/src/infrastructure/providers/ProvidersRegistryRepository';
import type { OpacappNormalizedProvider } from '@/src/domain/models/opacapp';

type LibraryPickerScreenProps = {
  onClose: () => void;
};

const formatLocation = (provider: OpacappNormalizedProvider) => {
  const location = provider.location;
  if (!location) return '';
  return [location.city, location.state, location.country].filter(Boolean).join(', ');
};

const normalizeQuery = (query: string) => query.trim().toLowerCase();

const scoreProvider = (provider: OpacappNormalizedProvider, query: string) => {
  const normalized = normalizeQuery(query);
  if (!normalized) return 0;

  const title = provider.title.toLowerCase();
  const id = provider.id.toLowerCase();
  const api = provider.api.toLowerCase();
  const location = formatLocation(provider).toLowerCase();
  const haystack = [title, id, api, location].filter(Boolean).join(' ');
  if (!haystack.includes(normalized)) return 0;

  const tokens = normalized.split(/\s+/).filter(Boolean);
  const allTokensPresent = tokens.every((token) => haystack.includes(token));
  let score = 0;

  if (id === normalized) score += 120;
  if (title === normalized) score += 110;
  if (title.startsWith(normalized)) score += 80;
  if (id.startsWith(normalized)) score += 70;
  if (title.includes(normalized)) score += 50;
  if (location.startsWith(normalized)) score += 35;
  if (location.includes(normalized)) score += 25;
  if (api.includes(normalized)) score += 15;
  if (allTokensPresent) score += 10;

  return score;
};

const filterAndSortProviders = (providers: OpacappNormalizedProvider[], query: string) => {
  const normalized = normalizeQuery(query);
  if (!normalized) return providers;

  return providers
    .map((provider) => ({ provider, score: scoreProvider(provider, normalized) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.provider.title.localeCompare(b.provider.title);
    })
    .map((entry) => entry.provider);
};

export function LibraryPickerScreen({ onClose }: LibraryPickerScreenProps) {
  const { activeLibraryId, setActiveLibraryId } = useActiveLibrary();
  const [query, setQuery] = useState('');

  const providers = useMemo(() => providersRegistryRepository.listProviders(), []);
  const filteredProviders = useMemo(
    () => filterAndSortProviders(providers, query),
    [providers, query],
  );

  const handleSelect = async (provider: OpacappNormalizedProvider) => {
    await setActiveLibraryId(provider.id);
    onClose();
  };

  const handleSubmit = async () => {
    if (filteredProviders.length === 1) {
      await handleSelect(filteredProviders[0]);
      return;
    }
    Keyboard.dismiss();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.backButton}>
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Choose your library</Text>
      </View>

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search by name, city, or ID"
        placeholderTextColor="rgba(0,0,0,0.4)"
        style={styles.searchInput}
        returnKeyType="search"
        onSubmitEditing={handleSubmit}
      />

      <FlatList
        data={filteredProviders}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const isActive = item.id === activeLibraryId;
          return (
            <TouchableOpacity onPress={() => handleSelect(item)} style={styles.row}>
              <View style={styles.rowContent}>
                <Text style={styles.rowTitle}>{item.title}</Text>
                <Text style={styles.rowMeta}>{formatLocation(item) || item.api}</Text>
              </View>
              <View style={[styles.badge, isActive ? styles.badgeActive : styles.badgeInactive]}>
                <Text style={[styles.badgeText, isActive ? styles.badgeTextActive : styles.badgeTextInactive]}>
                  {isActive ? 'Active' : 'Select'}
                </Text>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>
              {normalizeQuery(query) ? 'No matching libraries' : 'No libraries available'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {normalizeQuery(query)
                ? 'Try a different name, city, or library ID.'
                : 'Check back later or adjust your filters.'}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
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
    borderColor: 'rgba(0,0,0,0.12)',
  },
  backButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
  },
  searchInput: {
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.15)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 12,
  },
  listContent: {
    paddingBottom: 24,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    marginBottom: 10,
  },
  rowContent: {
    flex: 1,
    marginRight: 12,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  rowMeta: {
    marginTop: 4,
    fontSize: 12,
    opacity: 0.6,
  },
  badge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  badgeActive: {
    backgroundColor: '#111827',
  },
  badgeInactive: {
    backgroundColor: '#e5e7eb',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  badgeTextActive: {
    color: '#fff',
  },
  badgeTextInactive: {
    color: '#111827',
  },
  emptyState: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  emptySubtitle: {
    marginTop: 6,
    fontSize: 12,
    opacity: 0.6,
  },
});
