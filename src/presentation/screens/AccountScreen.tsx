import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useMemo, useState } from 'react';

import { useActiveLibrary } from '@/src/application/state/ActiveLibraryStore';
import { useAccountSession } from '@/src/application/state/AccountSessionStore';
import { useAppPalette, type AppPalette } from '@/src/presentation/theme/palette';

type AccountScreenProps = {
  onBack: () => void;
  onPickLibrary: () => void;
};

const formatStatusLabel = (status: string) => {
  switch (status) {
    case 'logged_in':
      return 'Signed in (scaffold)';
    case 'logging_in':
      return 'Signing in…';
    case 'error':
      return 'Sign-in error';
    default:
      return 'Signed out';
  }
};

export function AccountScreen({ onBack, onPickLibrary }: AccountScreenProps) {
  const { activeLibrary, isLoading } = useActiveLibrary();
  const { status, identity, snapshot, feedback, login, logout, refreshSnapshot } =
    useAccountSession();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const palette = useAppPalette();
  const styles = useMemo(() => createStyles(palette), [palette]);

  const canSubmit = Boolean(activeLibrary) && status !== 'logging_in';
  const isLoggedIn = status === 'logged_in';

  const handleLogin = async () => {
    if (!activeLibrary) {
      onPickLibrary();
      return;
    }
    await login({ provider: activeLibrary, username, password });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Library account</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Active library</Text>
          <Text style={styles.cardBody}>
            {isLoading ? 'Loading selection…' : activeLibrary?.title ?? 'No library selected yet'}
          </Text>
          {!activeLibrary && !isLoading ? (
            <TouchableOpacity onPress={onPickLibrary} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Choose a library</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Account status</Text>
          <Text style={styles.cardBody}>{formatStatusLabel(status)}</Text>
          {identity ? (
            <Text style={styles.cardMeta}>
              {identity.username ? `${identity.username} · ` : ''}
              {identity.providerTitle}
            </Text>
          ) : null}
          {feedback ? (
            <Text
              style={[
                styles.feedbackText,
                feedback.tone === 'error' ? styles.feedbackError : styles.feedbackInfo,
              ]}
            >
              {feedback.message}
            </Text>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Sign in</Text>
          <Text style={styles.cardBody}>
            Use your library card credentials. This is scaffolding only and does not perform live
            authentication yet.
          </Text>
          <TextInput
            value={username}
            onChangeText={setUsername}
            placeholder="Library card number"
            placeholderTextColor={palette.inputPlaceholder}
            style={styles.input}
            autoCapitalize="none"
            editable={canSubmit}
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="PIN / password"
            placeholderTextColor={palette.inputPlaceholder}
            style={styles.input}
            secureTextEntry
            editable={canSubmit}
          />
          <View style={styles.buttonRow}>
            <TouchableOpacity
              onPress={handleLogin}
              style={[styles.primaryButton, !canSubmit && styles.primaryButtonDisabled]}
              disabled={!canSubmit}
            >
              <Text style={styles.primaryButtonText}>
                {status === 'logging_in' ? 'Signing in…' : 'Sign in'}
              </Text>
            </TouchableOpacity>
            {isLoggedIn ? (
              <TouchableOpacity onPress={logout} style={styles.secondaryButtonInline}>
                <Text style={styles.secondaryButtonText}>Sign out</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Loans & reservations</Text>
          <Text style={styles.cardBody}>
            {snapshot
              ? `Loans: ${snapshot.loans.length} · Reservations: ${snapshot.reservations.length}`
              : 'No account snapshot yet.'}
          </Text>
          <TouchableOpacity
            onPress={refreshSnapshot}
            style={[styles.secondaryButton, !isLoggedIn && styles.secondaryButtonDisabled]}
            disabled={!isLoggedIn}
          >
            <Text style={styles.secondaryButtonText}>Refresh snapshot</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (palette: AppPalette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: palette.background,
    },
    content: {
      padding: 24,
      paddingBottom: 32,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    backButton: {
      minHeight: 44,
      minWidth: 44,
      paddingVertical: 10,
      paddingHorizontal: 14,
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
      fontSize: 24,
      fontWeight: '600',
      color: palette.text,
    },
    card: {
      marginTop: 20,
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: palette.border,
      backgroundColor: palette.surface,
    },
    cardTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: palette.text,
    },
    cardBody: {
      marginTop: 8,
      fontSize: 14,
      lineHeight: 20,
      color: palette.textSubtle,
    },
    cardMeta: {
      marginTop: 8,
      fontSize: 12,
      color: palette.textMuted,
    },
    feedbackText: {
      marginTop: 10,
      fontSize: 13,
      lineHeight: 18,
    },
    feedbackInfo: {
      color: palette.textSubtle,
    },
    feedbackError: {
      color: palette.danger,
    },
    input: {
      marginTop: 12,
      borderWidth: 1,
      borderColor: palette.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      color: palette.text,
      backgroundColor: palette.background,
    },
    buttonRow: {
      marginTop: 14,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flexWrap: 'wrap',
    },
    primaryButton: {
      borderRadius: 10,
      backgroundColor: palette.primary,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    primaryButtonDisabled: {
      opacity: 0.5,
    },
    primaryButtonText: {
      fontSize: 13,
      fontWeight: '600',
      color: palette.primaryText,
    },
    secondaryButton: {
      marginTop: 12,
      alignSelf: 'flex-start',
      borderRadius: 10,
      borderWidth: 1,
      borderColor: palette.border,
      paddingHorizontal: 14,
      paddingVertical: 10,
      backgroundColor: palette.secondary,
    },
    secondaryButtonInline: {
      borderRadius: 10,
      borderWidth: 1,
      borderColor: palette.border,
      paddingHorizontal: 14,
      paddingVertical: 10,
      backgroundColor: palette.secondary,
    },
    secondaryButtonDisabled: {
      opacity: 0.55,
    },
    secondaryButtonText: {
      fontSize: 13,
      fontWeight: '600',
      color: palette.secondaryText,
    },
  });
