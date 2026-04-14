import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
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
    <View style={styles.container}>
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
    card: {
      marginBottom: 16,
      padding: 16,
      borderRadius: 16,
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
      fontSize: 15,
      color: palette.textMuted,
    },
    cardMeta: {
      marginTop: 6,
      fontSize: 12,
      color: palette.textSubtle,
    },
    input: {
      marginTop: 12,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: palette.inputBorder,
      backgroundColor: palette.inputBackground,
      color: palette.inputText,
      fontSize: 14,
    },
    buttonRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginTop: 16,
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
      fontSize: 13,
      fontWeight: '600',
    },
    secondaryButton: {
      marginTop: 12,
      alignSelf: 'flex-start',
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: palette.border,
      backgroundColor: palette.secondary,
    },
    secondaryButtonInline: {
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: palette.border,
      backgroundColor: palette.secondary,
    },
    secondaryButtonDisabled: {
      opacity: 0.55,
    },
    secondaryButtonText: {
      fontSize: 12,
      fontWeight: '600',
      color: palette.secondaryText,
    },
    feedbackText: {
      marginTop: 10,
      fontSize: 12,
    },
    feedbackInfo: {
      color: palette.textSubtle,
    },
    feedbackError: {
      color: palette.dangerText,
    },
  });
