import { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { useAccountSession } from '@/src/application/state/AccountSessionStore';
import { useActiveLibrary } from '@/src/application/state/ActiveLibraryStore';
import {
  Button,
  Card,
  ScreenHeader,
  ScreenLayout,
  StateNotice,
} from '@/src/presentation/components/ScreenChrome';
import { useAppPalette, type AppPalette } from '@/src/presentation/theme/palette';

type AccountScreenProps = {
  onBack: () => void;
  onPickLibrary: () => void;
};

export function AccountScreen({ onBack, onPickLibrary }: AccountScreenProps) {
  const { activeLibrary } = useActiveLibrary();
  const {
    status,
    identity,
    snapshot,
    error,
    login,
    logout,
    refreshSnapshot,
  } = useAccountSession();
  const [username, setUsername] = useState(identity?.username ?? '');
  const [password, setPassword] = useState('');
  const palette = useAppPalette();
  const styles = useMemo(() => createStyles(palette), [palette]);

  const canSubmit = Boolean(activeLibrary) && status !== 'logging_in';
  const isLoggedIn = status === 'logged_in';

  const handleLogin = async () => {
    if (!activeLibrary || status === 'logging_in') {
      if (!activeLibrary) {
        onPickLibrary();
      }
      return;
    }

    await login({
      username: username.trim(),
      password,
      providerTitle: activeLibrary.title,
      providerId: activeLibrary.id,
    });
  };

  const feedback = error
    ? { tone: 'error' as const, message: error }
    : isLoggedIn
      ? { tone: 'info' as const, message: 'Signed in with scaffold session state.' }
      : null;

  return (
    <ScreenLayout scrollable>
      <ScreenHeader title="Account" onBack={onBack} />

      <Card
        title="Active library"
        body={activeLibrary ? activeLibrary.title : 'No library selected yet.'}
        meta={identity ? identity.providerTitle : undefined}
      >
        {feedback ? <StateNotice message={feedback.message} tone={feedback.tone} /> : null}
      </Card>

      <Card
        title="Sign in"
        body="Use your library card credentials. This is scaffolding only and does not perform live authentication yet."
      >
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
          <Button
            label={status === 'logging_in' ? 'Signing in…' : 'Sign in'}
            onPress={handleLogin}
            variant="primary"
            disabled={!canSubmit}
          />
          {isLoggedIn ? <Button label="Sign out" onPress={logout} variant="secondary" /> : null}
        </View>
      </Card>

      <Card
        title="Loans & reservations"
        body={
          snapshot
            ? `Loans: ${snapshot.loans.length} · Reservations: ${snapshot.reservations.length}`
            : 'No account snapshot yet.'
        }
      >
        <Button
          label="Refresh snapshot"
          onPress={refreshSnapshot}
          variant="secondary"
          disabled={!isLoggedIn}
          style={styles.actionButton}
        />
      </Card>
    </ScreenLayout>
  );
}

const createStyles = (palette: AppPalette) =>
  StyleSheet.create({
    input: {
      marginTop: 12,
      borderWidth: 1,
      borderColor: palette.inputBorder,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      color: palette.inputText,
      backgroundColor: palette.inputBackground,
    },
    buttonRow: {
      marginTop: 14,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flexWrap: 'wrap',
    },
    actionButton: {
      marginTop: 12,
    },
  });
