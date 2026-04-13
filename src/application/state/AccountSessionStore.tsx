import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

import type {
  LibraryAccountIdentity,
  LibraryAccountSession,
} from '@/src/application/ports/LibrarySystemAdapter';
import { createLibrarySystemAdapter } from '@/src/infrastructure/opac/AdapterRegistry';
import { providersRegistryRepository } from '@/src/infrastructure/providers/ProvidersRegistryRepository';
import type { AccountSnapshot } from '@/src/domain/models/account';
import type { OpacappNormalizedProvider } from '@/src/domain/models/opacapp';
import { readJson, removeKey, storageKeys, writeJson } from '@/src/infrastructure/storage/PersistentStorage';

export type AccountSessionStatus = 'logged_out' | 'logging_in' | 'logged_in' | 'error';

type AccountSessionFeedback = {
  tone: 'info' | 'error';
  message: string;
};

type PersistedAccountSession = {
  status: 'logged_in' | 'logged_out';
  identity: LibraryAccountIdentity | null;
  session: LibraryAccountSession | null;
};

type AccountSessionContextValue = {
  status: AccountSessionStatus;
  identity: LibraryAccountIdentity | null;
  session: LibraryAccountSession | null;
  snapshot: AccountSnapshot | null;
  feedback: AccountSessionFeedback | null;
  login: (input: {
    provider: OpacappNormalizedProvider;
    username: string;
    password: string;
  }) => Promise<void>;
  logout: () => void;
  refreshSnapshot: () => Promise<void>;
};

const AccountSessionContext = createContext<AccountSessionContextValue | null>(null);

export function AccountSessionProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AccountSessionStatus>('logged_out');
  const [identity, setIdentity] = useState<LibraryAccountIdentity | null>(null);
  const [session, setSession] = useState<LibraryAccountSession | null>(null);
  const [snapshot, setSnapshot] = useState<AccountSnapshot | null>(null);
  const [feedback, setFeedback] = useState<AccountSessionFeedback | null>(null);

  useEffect(() => {
    let isMounted = true;
    readJson<PersistedAccountSession | null>(storageKeys.accountSession, null)
      .then((stored) => {
        if (!isMounted || !stored) return;
        if (stored.status !== 'logged_in' || !stored.identity) {
          return;
        }
        const provider = providersRegistryRepository.getProviderById(stored.identity.providerId);
        if (!provider) {
          void removeKey(storageKeys.accountSession);
          return;
        }
        setStatus('logged_in');
        setIdentity(stored.identity);
        setSession(stored.session ?? null);
      })
      .catch(() => null);

    return () => {
      isMounted = false;
    };
  }, []);

  const persistSession = async (
    nextStatus: AccountSessionStatus,
    nextIdentity: LibraryAccountIdentity | null,
    nextSession: LibraryAccountSession | null,
  ) => {
    if (nextStatus !== 'logged_in' || !nextIdentity) {
      await removeKey(storageKeys.accountSession);
      return;
    }

    const sanitizedSession = nextSession
      ? {
          id: nextSession.id,
          createdAt: nextSession.createdAt,
        }
      : null;

    const payload: PersistedAccountSession = {
      status: 'logged_in',
      identity: nextIdentity,
      session: sanitizedSession,
    };

    await writeJson(storageKeys.accountSession, payload);
  };

  const login = async (input: {
    provider: OpacappNormalizedProvider;
    username: string;
    password: string;
  }) => {
    setStatus('logging_in');
    setFeedback(null);

    const adapter = createLibrarySystemAdapter(input.provider);
    if (!adapter.accountLogin) {
      setStatus('logged_out');
      setFeedback({
        tone: 'info',
        message: 'This library does not support account login yet.',
      });
      await persistSession('logged_out', null, null);
      return;
    }

    const result = await adapter.accountLogin({
      username: input.username,
      password: input.password,
    });

    if (result.status === 'success') {
      setIdentity(result.identity);
      setSession(result.session);
      setSnapshot(null);
      setStatus('logged_in');
      await persistSession('logged_in', result.identity, result.session);
      if (result.message) {
        setFeedback({ tone: 'info', message: result.message });
      }
      return;
    }

    if (result.status === 'not_supported') {
      setStatus('logged_out');
      setFeedback({
        tone: 'info',
        message: result.message ?? 'Account login is not supported for this library yet.',
      });
      await persistSession('logged_out', null, null);
      return;
    }

    setStatus('error');
    setFeedback({
      tone: 'error',
      message: result.message ?? 'Login failed. Please try again.',
    });
    await persistSession('logged_out', null, null);
  };

  const logout = () => {
    setStatus('logged_out');
    setIdentity(null);
    setSession(null);
    setSnapshot(null);
    setFeedback(null);
    void persistSession('logged_out', null, null);
  };

  const refreshSnapshot = async () => {
    if (!identity || !session) {
      setFeedback({
        tone: 'info',
        message: 'Sign in to refresh your loans and reservations.',
      });
      return;
    }

    const provider = providersRegistryRepository.getProviderById(identity.providerId);
    if (!provider) {
      setFeedback({
        tone: 'error',
        message: 'Provider metadata is missing for this session.',
      });
      return;
    }

    const adapter = createLibrarySystemAdapter(provider);
    if (!adapter.fetchAccountSnapshot) {
      setFeedback({
        tone: 'info',
        message: 'Account snapshots are not available for this library yet.',
      });
      return;
    }

    const result = await adapter.fetchAccountSnapshot({ identity, session });
    if (result.status === 'success') {
      setSnapshot(result.snapshot);
      if (result.message) {
        setFeedback({ tone: 'info', message: result.message });
      }
      return;
    }

    setFeedback({
      tone: result.status === 'not_supported' ? 'info' : 'error',
      message: result.message ?? 'Unable to fetch account snapshot.',
    });
  };

  const value = useMemo(
    () => ({
      status,
      identity,
      session,
      snapshot,
      feedback,
      login,
      logout,
      refreshSnapshot,
    }),
    [status, identity, session, snapshot, feedback],
  );

  return <AccountSessionContext.Provider value={value}>{children}</AccountSessionContext.Provider>;
}

export function useAccountSession(): AccountSessionContextValue {
  const context = useContext(AccountSessionContext);
  if (!context) {
    throw new Error('useAccountSession must be used within AccountSessionProvider');
  }
  return context;
}
