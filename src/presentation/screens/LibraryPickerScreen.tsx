import { useMemo, useState } from 'react';
import { FlatList, Keyboard, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useActiveLibrary } from '@/src/application/state/ActiveLibraryStore';
import type { OpacappNormalizedProvider } from '@/src/domain/models/opacapp';
import { providersRegistryRepository } from '@/src/infrastructure/providers/ProvidersRegistryRepository';
import {
  Badge,
  Card,
  Input,
  ScreenHeader,
  ScreenLayout,
} from '@/src/presentation/components/ScreenChrome';
import { useAppPalette, type AppPalette } from '@/src/presentation/theme/palette';

type LibraryPickerScreenProps = {
  onClose: () => void;
};

const normalizeQuery = (value: string) => value.trim().toLowerCase();

const formatLocation = (provider: OpacappNormalizedProvider) => {
  const parts = [
    provider.location?.city,
    provider.location?.state,
    provider.location?.country,
  ].filter(Boolean);
  return parts.join(', ');
};

type IndexedProvider = {
  provider: OpacappNormalizedProvider;
  location: string;
  searchText: string;
};

const buildSearchText = (provider: OpacappNormalizedProvider, location: string) =>
  [
    provider.id,
    provider.title,
    provider.api,
    location,
    provider.source.file,
    provider.source.path,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

const indexProviders = (providers: OpacappNormalizedProvider[]): IndexedProvider[] =>
  providers
    .map((provider) => {
      const location = formatLocation(provider);
      return {
        provider,
        location,
        searchText: buildSearchText(provider, location),
      };
    })
    .sort((left, right) => left.provider.title.localeCompare(right.provider.title));

const filterProviders = (providers: IndexedProvider[], query: string) => {
  const normalizedQuery = normalizeQuery(query);
  if (!normalizedQuery) {
    return providers;
  }

  return providers.filter(({ searchText }) => searchText.includes(normalizedQuery));
};

const getHealthLabel = (provider: OpacappNormalizedProvider, isActive: boolean) => {
  if (isActive) return 'Active';

  switch (provider.healthStatus) {
    case 'green':
      return 'Healthy';
    case 'red':
      return 'Down';
    case 'unsupported':
      return 'Unsupported';
    default:
      return 'Unknown';
  }
};

const getHealthBadgeTone = (provider: OpacappNormalizedProvider, isActive: boolean) => {
  if (isActive) return 'primary' as const;

  switch (provider.healthStatus) {
    case 'green':
      return 'success' as const;
    case 'red':
      return 'danger' as const;
    case 'unsupported':
      return 'warning' as const;
    default:
      return 'neutral' as const;
  }
};

export function LibraryPickerScreen({ onClose }: LibraryPickerScreenProps) {
  const palette = useAppPalette();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const { activeLibraryId, setActiveLibraryId } = useActiveLibrary();
  const [query, setQuery] = useState('');

  const providers = useMemo(() => providersRegistryRepository.listProviders(), []);
  const indexedProviders = useMemo(() => indexProviders(providers), [providers]);
  const filteredProviders = useMemo(
    () => filterProviders(indexedProviders, query),
    [indexedProviders, query],
  );

  const handleSelect = async (provider: OpacappNormalizedProvider) => {
    await setActiveLibraryId(provider.id);
    onClose();
  };

  const handleSubmit = async () => {
    if (filteredProviders.length === 1) {
      await handleSelect(filteredProviders[0].provider);
      return;
    }
    Keyboard.dismiss();
  };

  return (
    <ScreenLayout contentStyle={styles.content}>
      <FlatList
        data={filteredProviders}
        keyExtractor={(item) => item.provider.id}
        keyboardShouldPersistTaps="handled"
        style={styles.list}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.headerContent}>
            <ScreenHeader
              title="Choose your library"
              subtitle="Search by name, city, country, provider ID, or source file."
              onBack={onClose}
            />

            <Card>
              <Input
                value={query}
                onChangeText={setQuery}
                placeholder="Search by name, city, or ID"
                returnKeyType="search"
                onSubmitEditing={handleSubmit}
              />
            </Card>
          </View>
        }
        renderItem={({ item }) => {
          const { provider, location } = item;
          const isActive = provider.id === activeLibraryId;
          return (
            <TouchableOpacity onPress={() => handleSelect(provider)} style={styles.row}>
              <View style={styles.rowContent}>
                <Text style={styles.rowTitle}>{provider.title}</Text>
                <Text style={styles.rowMeta}>
                  {location ? `${location} - ${provider.api}` : provider.api}
                </Text>
              </View>
              <Badge
                label={getHealthLabel(provider, isActive)}
                tone={getHealthBadgeTone(provider, isActive)}
              />
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <Card style={styles.emptyState}>
            <Text style={styles.emptyTitle}>
              {normalizeQuery(query) ? 'No matching libraries' : 'No libraries available'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {normalizeQuery(query)
                ? 'Try a different name, city, or library ID.'
                : 'Check back later or adjust your filters.'}
            </Text>
          </Card>
        }
      />
    </ScreenLayout>
  );
}

const createStyles = (palette: AppPalette) =>
  StyleSheet.create({
    content: {
      paddingBottom: 0,
    },
    list: {
      flex: 1,
    },
    listContent: {
      gap: 10,
      paddingBottom: 24,
    },
    headerContent: {
      gap: 20,
      marginBottom: 10,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 14,
      paddingHorizontal: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: palette.border,
      backgroundColor: palette.surface,
    },
    rowContent: {
      flex: 1,
      marginRight: 12,
    },
    rowTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: palette.text,
    },
    rowMeta: {
      marginTop: 4,
      fontSize: 12,
      color: palette.textSubtle,
    },
    emptyState: {
      marginTop: 0,
      alignItems: 'center',
      paddingVertical: 40,
    },
    emptyTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: palette.text,
    },
    emptySubtitle: {
      marginTop: 6,
      fontSize: 12,
      color: palette.textSubtle,
      textAlign: 'center',
    },
  });
