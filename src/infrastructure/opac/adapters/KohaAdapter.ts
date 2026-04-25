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
  OpacSearchFailureKind,
  OpacSearchResult,
} from '@/src/domain/models/opac';
import type { OpacappNormalizedProvider } from '@/src/domain/models/opacapp';
import { parseKohaSearchResults } from '@/src/infrastructure/opac/parsers/koha/parseKohaSearchResults';
import {
  buildAdapterFallbackRoutes,
  isHttp404Error,
} from '@/src/infrastructure/opac/transport/adapterFallbackRoutes';
import { fetchTextWithRetry } from '@/src/infrastructure/opac/transport/fetchWithRetry';
import { normalizeProviderBaseUrl } from '@/src/infrastructure/opac/transport/normalizeProviderBaseUrl';

const DEFAULT_PAGE_SIZE = 20;

const buildFailure = (kind: OpacSearchFailureKind, error: unknown) => ({
  kind,
  message: error instanceof Error ? error.message : 'Unknown search error.',
});

export class KohaAdapter implements LibrarySystemAdapter {
  readonly system = 'koha';
  private provider: OpacappNormalizedProvider;

  constructor(provider: OpacappNormalizedProvider) {
    this.provider = provider;
  }

  async search(input: LibrarySystemSearchInput): Promise<OpacSearchResult> {
    const query = input.query.trim();
    const page = input.page ?? 1;

    if (!query || !this.provider.baseUrl) {
      return { total: 0, page, pageSize: DEFAULT_PAGE_SIZE, records: [] };
    }

    const baseUrl = this.normalizeBaseUrl();
    let html: string;
    try {
      html = await this.fetchSearchHtml(baseUrl, query, page);
    } catch (error) {
      console.warn('[KohaAdapter] search transport failed', error);
      return {
        total: 0,
        page,
        pageSize: DEFAULT_PAGE_SIZE,
        records: [],
        diagnostics: { failure: buildFailure('transport', error) },
      };
    }

    try {
      const parsed = parseKohaSearchResults(html, baseUrl);
      return {
        total: parsed.total ?? parsed.records.length,
        page,
        pageSize: DEFAULT_PAGE_SIZE,
        records: parsed.records,
      };
    } catch (error) {
      console.warn('[KohaAdapter] search parse failed', error);
      return {
        total: 0,
        page,
        pageSize: DEFAULT_PAGE_SIZE,
        records: [],
        diagnostics: { failure: buildFailure('parser', error) },
      };
    }
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
      message: 'Koha adapter account login is not supported in this initial slice.',
    };
  }

  async fetchAccountSnapshot(): Promise<LibraryAccountSnapshotResult> {
    return {
      status: 'not_supported',
      message: 'Koha adapter account snapshots are not supported in this initial slice.',
    };
  }

  private normalizeBaseUrl() {
    const candidate = (this.provider.baseUrl ?? 'https://example.invalid').trim();
    return (
      normalizeProviderBaseUrl(candidate, { api: this.system, providerId: this.provider.id }).normalizedUrl ??
      candidate
    ).replace(/\/+$/, '');
  }

  private async fetchSearchHtml(baseUrl: string, query: string, page: number): Promise<string> {
    const { candidates } = buildAdapterFallbackRoutes({
      system: this.system,
      baseUrl,
      query,
      page,
      pageSize: DEFAULT_PAGE_SIZE,
      providerId: this.provider.id,
    });

    for (const candidate of candidates) {
      try {
        return await this.fetchHtml(candidate.url);
      } catch (error) {
        if (!isHttp404Error(error)) {
          throw error;
        }
      }
    }

    throw new Error('Koha search failed for all fallback routes with HTTP 404');
  }

  private async fetchHtml(url: string): Promise<string> {
    return await fetchTextWithRetry(url, {
      headers: {
        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
      },
    });
  }
}
