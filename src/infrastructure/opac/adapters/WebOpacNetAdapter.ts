import type {
  LibrarySystemAdapter,
  LibraryAccountLoginInput,
  LibraryAccountLoginResult,
  LibraryAccountSnapshotResult,
  LibrarySystemSearchInput,
} from '@/src/application/ports/LibrarySystemAdapter';
import type { OpacAvailability, OpacRecord, OpacSearchResult } from '@/src/domain/models/opac';
import type { OpacappNormalizedProvider } from '@/src/domain/models/opacapp';
import { parseWebOpacNetSearchResults } from '@/src/infrastructure/opac/parsers/webopacnet/parseWebOpacNetSearchResults';
import { fetchTextWithRetry } from '@/src/infrastructure/opac/transport/fetchWithRetry';
import { normalizeProviderBaseUrl } from '@/src/infrastructure/opac/transport/normalizeProviderBaseUrl';

const DEFAULT_PAGE_SIZE = 20;

export class WebOpacNetAdapter implements LibrarySystemAdapter {
  readonly system = 'webopac.net';
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

    try {
      const url = this.buildSearchUrl(query, page);
      const html = await this.fetchText(url);
      const parsed = parseWebOpacNetSearchResults(html, this.normalizeBaseUrl());

      return {
        total: parsed.total ?? parsed.records.length,
        page,
        pageSize: DEFAULT_PAGE_SIZE,
        records: parsed.records,
      };
    } catch (error) {
      console.warn('[WebOpacNetAdapter] search failed', error);
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
      message: 'webopac.net account login is not supported in this initial slice.',
    };
  }

  async fetchAccountSnapshot(): Promise<LibraryAccountSnapshotResult> {
    return {
      status: 'not_supported',
      message: 'webopac.net account snapshots are not supported in this initial slice.',
    };
  }

  private normalizeBaseUrl() {
    const candidate = this.provider.baseUrl?.trim() || '';
    return (
      normalizeProviderBaseUrl(candidate, { api: this.system, providerId: this.provider.id }).normalizedUrl ??
      candidate
    ).replace(/\/+$/, '');
  }

  private buildSearchUrl(query: string, page: number) {
    const endpoint = `${this.normalizeBaseUrl()}/search.aspx`;
    const params = new URLSearchParams({
      STICHWORT: query,
      Seite: String(page),
    });
    return `${endpoint}?${params.toString()}`;
  }

  private async fetchText(url: string): Promise<string> {
    return await fetchTextWithRetry(url, {
      headers: { Accept: 'text/html,application/xhtml+xml' },
    });
  }
}
