import type {
  LibrarySystemAdapter,
  LibrarySystemSearchInput,
  LibraryAccountLoginInput,
  LibraryAccountLoginResult,
  LibraryAccountSnapshotResult,
  LibraryAccountSession,
  LibraryAccountIdentity,
} from '@/src/application/ports/LibrarySystemAdapter';
import type { OpacAvailability, OpacRecord, OpacSearchResult } from '@/src/domain/models/opac';
import type { OpacappNormalizedProvider } from '@/src/domain/models/opacapp';
import { parseAdisSearchResults } from '@/src/infrastructure/opac/parsers/adis/parseAdisSearchResults';

const DEFAULT_PAGE_SIZE = 20;

export class AdisAdapter implements LibrarySystemAdapter {
  readonly system = 'adis';
  private provider: OpacappNormalizedProvider;

  constructor(provider: OpacappNormalizedProvider) {
    this.provider = provider;
  }

  async search(input: LibrarySystemSearchInput): Promise<OpacSearchResult> {
    const page = input.page ?? 1;
    const query = input.query.trim();

    if (!query) {
      return { total: 0, page, pageSize: DEFAULT_PAGE_SIZE, records: [] };
    }

    const parsed = parseAdisSearchResults({ records: [] }, this.provider.baseUrl);

    return {
      total: parsed.total,
      page,
      pageSize: DEFAULT_PAGE_SIZE,
      records: parsed.records,
    };
  }

  async details(_input: { recordId: string; detailUrl?: string }): Promise<OpacRecord | null> {
    return null;
  }

  async availability(input: { recordId: string }): Promise<OpacAvailability> {
    return {
      recordId: input.recordId,
      availableCount: 0,
      totalCount: 0,
      holdsCount: 0,
    };
  }

  async accountLogin(input: LibraryAccountLoginInput): Promise<LibraryAccountLoginResult> {
    if (!input.username.trim() || !input.password.trim()) {
      return {
        status: 'invalid_credentials',
        message: 'Please enter both username and password.',
      };
    }

    return {
      status: 'success',
      identity: this.buildIdentity(input.username),
      session: this.buildSession(),
      message: 'Login scaffolding only. No live ADIS authentication yet.',
    };
  }

  async fetchAccountSnapshot(): Promise<LibraryAccountSnapshotResult> {
    return {
      status: 'success',
      snapshot: {
        loans: [],
        reservations: [],
      },
      message: 'Account snapshot scaffolding only. No live ADIS data yet.',
    };
  }

  private buildIdentity(username: string): LibraryAccountIdentity {
    return {
      providerId: this.provider.id,
      providerTitle: this.provider.title,
      username: username.trim(),
      displayName: username.trim(),
      authHint: this.provider.authHint,
    };
  }

  private buildSession(): LibraryAccountSession {
    const issuedAt = new Date().toISOString();
    return {
      id: `${this.system}-${this.provider.id}-${Date.now()}`,
      providerId: this.provider.id,
      issuedAt,
      expiresAt: issuedAt,
      token: 'adis-scaffold-session',
    };
  }
}
