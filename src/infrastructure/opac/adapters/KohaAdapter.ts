import type {
  LibrarySystemAdapter,
  LibraryAccountLoginInput,
  LibraryAccountLoginResult,
  LibraryAccountSnapshotResult,
  LibrarySystemSearchInput,
} from '@/src/application/ports/LibrarySystemAdapter';
import type { OpacAvailability, OpacRecord, OpacSearchResult } from '@/src/domain/models/opac';
import type { OpacappNormalizedProvider } from '@/src/domain/models/opacapp';
import { parseKohaSearchResults } from '@/src/infrastructure/opac/parsers/koha/parseKohaSearchResults';

const DEFAULT_PAGE_SIZE = 20;
const DEFAULT_TIMEOUT_MS = 8000;

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

    try {
      const baseUrl = this.normalizeBaseUrl();
      const url = this.buildSearchUrl(baseUrl, query, page);
      const html = await this.fetchHtml(url);
      const parsed = parseKohaSearchResults(html, baseUrl);

      return {
        total: parsed.total ?? parsed.records.length,
        page,
        pageSize: DEFAULT_PAGE_SIZE,
        records: parsed.records,
      };
    } catch (error) {
      console.warn('[KohaAdapter] search failed', error);
      return { total: 0, page, pageSize: DEFAULT_PAGE_SIZE, records: [] };
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
    return (this.provider.baseUrl ?? 'https://example.invalid').trim().replace(/\/+$/, '');
  }

  private buildSearchUrl(baseUrl: string, query: string, page: number) {
    const params = new URLSearchParams({
      q: query,
      idx: 'kw',
      count: String(DEFAULT_PAGE_SIZE),
      offset: String(Math.max(0, page - 1) * DEFAULT_PAGE_SIZE),
      sort_by: 'relevance',
    });
    return `${baseUrl}/cgi-bin/koha/opac-search.pl?${params.toString()}`;
  }

  private async fetchHtml(url: string): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        headers: {
          Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Koha search request failed with HTTP ${response.status}`);
      }

      return await response.text();
    } finally {
      clearTimeout(timeout);
    }
  }
}
