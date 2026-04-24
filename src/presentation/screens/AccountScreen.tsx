import { useState } from 'react';

import { useAccountSession } from '@/src/application/state/AccountSessionStore';
import { useActiveLibrary } from '@/src/application/state/ActiveLibraryStore';
import {
  Button,
  Input,
  Inline,
  ScreenHeader,
  ScreenLayout,
  SectionCard,
  StateNotice,
} from '@/src/presentation/components/ScreenChrome';

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

      <SectionCard
        title="Active library"
        body={activeLibrary ? activeLibrary.title : 'No library selected yet.'}
        meta={identity ? identity.providerTitle : undefined}
      >
        {feedback ? <StateNotice message={feedback.message} tone={feedback.tone} /> : null}
      </SectionCard>

      <SectionCard
        title="Sign in"
        body="Use your library card credentials. This is scaffolding only and does not perform live authentication yet."
        footer={
          <Inline>
            <Button
              label={status === 'logging_in' ? 'Signing in…' : 'Sign in'}
              onPress={handleLogin}
              variant="primary"
              disabled={!canSubmit}
            />
            {isLoggedIn ? <Button label="Sign out" onPress={logout} variant="secondary" /> : null}
          </Inline>
        }
      >
        <Input
          value={username}
          onChangeText={setUsername}
          placeholder="Library card number"
          autoCapitalize="none"
          editable={canSubmit}
        />
        <Input
          value={password}
          onChangeText={setPassword}
          placeholder="PIN / password"
          secureTextEntry
          editable={canSubmit}
        />
      </SectionCard>

      <SectionCard
        title="Loans & reservations"
        body={
          snapshot
            ? `Loans: ${snapshot.loans.length} · Reservations: ${snapshot.reservations.length}`
            : 'No account snapshot yet.'
        }
        footer={
          <Button
            label="Refresh snapshot"
            onPress={refreshSnapshot}
            variant="secondary"
            disabled={!isLoggedIn}
          />
        }
      />
    </ScreenLayout>
  );
}
