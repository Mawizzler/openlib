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
  const parts = [provider.city, provider.state, provider.country].filter(Boolean);
  return parts.join(', ');
};

const filterAndSortProviders = (providers: OpacappNormalizedProvider[], query: string) => {
  const normalizedQuery = normalizeQuery(query);
  if (!normalizedQuery) {
    return [...providers].sort((left, right) => left.title.localeCompare(right.title));
  }

  return providers
    .filter((provider) => {
      const haystack = [provider.id, provider.title, provider.city, provider.state, provider.country]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    })
    .sort((left, right) => left.title.localeCompare(right.title));
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
    <ScreenLayout scrollable contentStyle={styles.content}>
      <ScreenHeader
        title="Choose your library"
        subtitle="Search by name, city, or provider ID."
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

      <FlatList
        data={filteredProviders}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        scrollEnabled={false}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const isActive = item.id === activeLibraryId;
          return (
            <TouchableOpacity onPress={() => handleSelect(item)} style={styles.row}>
              <View style={styles.rowContent}>
                <Text style={styles.rowTitle}>{item.title}</Text>
                <Text style={styles.rowMeta}>{formatLocation(item) || item.api}</Text>
              </View>
              <Badge label={getHealthLabel(item, isActive)} tone={getHealthBadgeTone(item, isActive)} />
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
      paddingBottom: 24,
    },
    listContent: {
      gap: 10,
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
