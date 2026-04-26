import type {
  LibrarySystemAdapter,
  LibraryAccountLoginInput,
  LibraryAccountLoginResult,
  LibraryAccountSnapshotResult,
  LibrarySystemSearchInput,
} from '@/src/application/ports/LibrarySystemAdapter';
import type {
  OpacAvailability,
  OpacRecord,
  OpacSearchResult,
} from '@/src/domain/models/opac';
import type { OpacappNormalizedProvider } from '@/src/domain/models/opacapp';
import { parseBibliothecaSearchResults } from '@/src/infrastructure/opac/parsers/bibliotheca/parseBibliothecaSearchResults';
import { buildAdapterFallbackRoutes } from '@/src/infrastructure/opac/transport/adapterFallbackRoutes';

const DEFAULT_PAGE_SIZE = 20;

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');

export class BibliothecaAdapter implements LibrarySystemAdapter {
  readonly system = 'bibliotheca';
  private provider: OpacappNormalizedProvider;

  constructor(provider: OpacappNormalizedProvider) {
    this.provider = provider;
  }

  async search(input: LibrarySystemSearchInput): Promise<OpacSearchResult> {
    const query = input.query.trim();
    const page = input.page ?? 1;

    if (!query) {
      return { total: 0, page, pageSize: DEFAULT_PAGE_SIZE, records: [] };
    }

    const baseUrl = trimTrailingSlash(this.provider.catalogUrl || this.provider.baseUrl || '');
    if (!baseUrl) {
      return { total: 0, page, pageSize: DEFAULT_PAGE_SIZE, records: [] };
    }

    const { candidates } = buildAdapterFallbackRoutes({
      system: this.system,
      baseUrl,
      query,
      page,
      pageSize: DEFAULT_PAGE_SIZE,
      providerId: this.provider.id,
    });
    let lastError: string | undefined;

    for (const candidate of candidates) {
      const url = candidate.url;
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            Accept: 'text/html,application/xhtml+xml',
          },
        });

        if (!response.ok) {
          lastError = `HTTP ${response.status} for ${url}`;
          continue;
        }

        const html = await response.text();
        const parsed = parseBibliothecaSearchResults(html, baseUrl);
        if (parsed.records.length === 0) continue;

        return {
          total: parsed.total ?? parsed.records.length,
          page,
          pageSize: DEFAULT_PAGE_SIZE,
          records: parsed.records,
        };
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }
    }

    if (lastError) {
      console.info(`[BibliothecaAdapter] No successful bibliotheca search result for ${this.provider.id}: ${lastError}`);
    }

    return {
      total: 0,
      page,
      pageSize: DEFAULT_PAGE_SIZE,
      records: [],
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

  async accountLogin(_input: LibraryAccountLoginInput): Promise<LibraryAccountLoginResult> {
    return {
      status: 'not_supported',
      message: 'Library account login is not supported in the initial Bibliotheca adapter.',
    };
  }

  async fetchAccountSnapshot(): Promise<LibraryAccountSnapshotResult> {
    return {
      status: 'not_supported',
      message: 'Account snapshots are not supported in the initial Bibliotheca adapter.',
    };
  }
}
