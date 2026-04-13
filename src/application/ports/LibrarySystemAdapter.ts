import type {
  OpacAvailability,
  OpacRecord,
  OpacSearchResult,
} from '@/src/domain/models/opac';
import type { AccountSnapshot } from '@/src/domain/models/account';
import type { OpacappAuthHint } from '@/src/domain/models/opacapp';

export type LibrarySystemSearchInput = {
  query: string;
  page?: number;
  filters?: Record<string, string | string[]>;
};

export type LibraryAccountLoginInput = {
  username: string;
  password: string;
};

export type LibraryAccountIdentity = {
  providerId: string;
  providerTitle: string;
  system: string;
  authHint: OpacappAuthHint;
  username?: string;
};

export type LibraryAccountSession = {
  id: string;
  createdAt: string;
  opaqueToken?: string;
};

export type LibraryAccountLoginResult =
  | {
      status: 'success';
      identity: LibraryAccountIdentity;
      session: LibraryAccountSession;
      message?: string;
    }
  | {
      status: 'not_supported' | 'invalid_credentials' | 'error';
      message?: string;
    };

export type LibraryAccountSnapshotResult =
  | {
      status: 'success';
      snapshot: AccountSnapshot;
      message?: string;
    }
  | {
      status: 'not_supported' | 'error';
      message?: string;
    };

export interface LibrarySystemAdapter {
  system: string;

  search(input: LibrarySystemSearchInput): Promise<OpacSearchResult>;
  details(input: { recordId: string; detailUrl?: string }): Promise<OpacRecord | null>;
  availability?(input: { recordId: string }): Promise<OpacAvailability>;
  accountLogin?(input: LibraryAccountLoginInput): Promise<LibraryAccountLoginResult>;
  fetchAccountSnapshot?(input: {
    identity: LibraryAccountIdentity;
    session: LibraryAccountSession;
  }): Promise<LibraryAccountSnapshotResult>;
}
