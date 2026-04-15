import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Keyboard,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import type { OpacappNormalizedProvider } from '@/src/domain/models/opacapp';
import { providersRegistryRepository } from '@/src/infrastructure/providers/ProvidersRegistryRepository';
import { useActiveLibrary } from '@/src/application/state/ActiveLibraryStore';
import { useAppPalette, type AppPalette } from '@/src/presentation/theme/palette';

type LibraryPickerScreenProps = {
  onClose: () => void;
};

const formatLocation = (provider: OpacappNormalizedProvider) => {
  const location = provider.location;
  if (!location) return '';

  return [location.city, location.state, location.country]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join(', ');
};

const normalizeQuery = (value: string) => value.trim().toLowerCase();

const scoreProvider = (provider: OpacappNormalizedProvider, query: string) => {
  if (!query) return 0;

  const title = provider.title.toLowerCase();
  const id = provider.id.toLowerCase();
  const api = provider.api.toLowerCase();
  const location = formatLocation(provider).toLowerCase();

  if (title === query) return 100;
  if (id === query) return 95;
  if (title.startsWith(query)) return 85;
  if (id.startsWith(query)) return 80;
  if (location.startsWith(query)) return 70;
  if (title.includes(query)) return 60;
  if (location.includes(query)) return 55;
  if (api.includes(query)) return 45;
  if (id.includes(query)) return 40;

  return -1;
};

const filterAndSortProviders = (providers: OpacappNormalizedProvider[], query: string) => {
  const normalized = normalizeQuery(query);
  if (!normalized) return providers;

  return providers
    .map((provider) => ({ provider, score: scoreProvider(provider, normalized) }))
    .filter((entry) => entry.score >= 0)
    .sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score;
      return a.provider.title.localeCompare(b.provider.title);
    })
    .map((entry) => entry.provider);
};

const getHealthLabel = (provider: OpacappNormalizedProvider, isActive: boolean) => {
  if (isActive) {
    return 'Active';
  }

  switch (provider.healthStatus) {
    case 'green':
      return 'Healthy';
    case 'red':
      return 'Failing';
    case 'unsupported':
      return 'Unsupported';
    default:
      return 'Unknown';
  }
};

const getHealthBadgeStyle = (provider: OpacappNormalizedProvider, isActive: boolean) => {
  if (isActive) {
    return 'active';
  }

  switch (provider.healthStatus) {
    case 'green':
      return 'healthy';
    case 'red':
      return 'down';
    case 'unsupported':
      return 'degraded';
    default:
      return 'unknown';
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
    <SafeAreaView style={styles.container}>
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
        placeholderTextColor={palette.inputPlaceholder}
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
          const healthBadge = getHealthBadgeStyle(item, isActive);
          return (
            <TouchableOpacity onPress={() => handleSelect(item)} style={styles.row}>
              <View style={styles.rowContent}>
                <Text style={styles.rowTitle}>{item.title}</Text>
                <Text style={styles.rowMeta}>{formatLocation(item) || item.api}</Text>
              </View>
              <View
                style={[
                  styles.badge,
                  healthBadge === 'active' && styles.badgeActive,
                  healthBadge === 'healthy' && styles.badgeHealthy,
                  healthBadge === 'degraded' && styles.badgeDegraded,
                  healthBadge === 'down' && styles.badgeDown,
                  healthBadge === 'unknown' && styles.badgeUnknown,
                ]}
              >
                <Text
                  style={[
                    styles.badgeText,
                    healthBadge === 'active' && styles.badgeTextActive,
                    healthBadge === 'healthy' && styles.badgeTextHealthy,
                    healthBadge === 'degraded' && styles.badgeTextDegraded,
                    healthBadge === 'down' && styles.badgeTextDown,
                    healthBadge === 'unknown' && styles.badgeTextUnknown,
                  ]}
                >
                  {getHealthLabel(item, isActive)}
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
    </SafeAreaView>
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
      minWidth: 44,
      minHeight: 44,
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: palette.border,
      backgroundColor: palette.surface,
      justifyContent: 'center',
      alignItems: 'center',
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
    searchInput: {
      borderWidth: 1,
      borderColor: palette.inputBorder,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 10,
      fontSize: 14,
      marginBottom: 12,
      backgroundColor: palette.inputBackground,
      color: palette.inputText,
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
      borderColor: palette.border,
      backgroundColor: palette.surface,
      marginBottom: 10,
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
    badge: {
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 999,
      borderWidth: 1,
    },
    badgeActive: {
      backgroundColor: palette.primary,
      borderColor: palette.primary,
    },
    badgeHealthy: {
      backgroundColor: '#e7f8ef',
      borderColor: '#5abf88',
    },
    badgeDegraded: {
      backgroundColor: '#fff6e8',
      borderColor: '#e1a23a',
    },
    badgeDown: {
      backgroundColor: '#ffecec',
      borderColor: '#d66767',
    },
    badgeUnknown: {
      backgroundColor: palette.surfaceMuted,
      borderColor: palette.border,
    },
    badgeText: {
      fontSize: 11,
      fontWeight: '600',
    },
    badgeTextActive: {
      color: palette.primaryText,
    },
    badgeTextHealthy: {
      color: '#1f7a4d',
    },
    badgeTextDegraded: {
      color: '#a06a16',
    },
    badgeTextDown: {
      color: '#b32626',
    },
    badgeTextUnknown: {
      color: palette.text,
    },
    emptyState: {
      paddingVertical: 40,
      alignItems: 'center',
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
