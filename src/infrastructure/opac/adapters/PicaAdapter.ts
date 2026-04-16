import type {
  LibrarySystemAdapter,
  LibraryAccountLoginInput,
  LibraryAccountLoginResult,
  LibraryAccountSnapshotResult,
  LibrarySystemSearchInput,
} from '@/src/application/ports/LibrarySystemAdapter';
import type { OpacAvailability, OpacRecord, OpacSearchResult } from '@/src/domain/models/opac';
import type { OpacappNormalizedProvider } from '@/src/domain/models/opacapp';
import { parsePicaSearchResults } from '@/src/infrastructure/opac/parsers/pica/parsePicaSearchResults';

const DEFAULT_PAGE_SIZE = 20;
const DEFAULT_TIMEOUT_MS = 8000;

export class PicaAdapter implements LibrarySystemAdapter {
  readonly system = 'pica';
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
      const payload = await this.fetchJson(url);
      const parsed = parsePicaSearchResults(payload, this.normalizeBaseUrl());

      return {
        total: parsed.total ?? parsed.records.length,
        page,
        pageSize: DEFAULT_PAGE_SIZE,
        records: parsed.records,
      };
    } catch (error) {
      console.warn('[PicaAdapter] search failed', error);
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
      message: 'Pica adapter account login is not supported in this initial slice.',
    };
  }

  async fetchAccountSnapshot(): Promise<LibraryAccountSnapshotResult> {
    return {
      status: 'not_supported',
      message: 'Pica adapter account snapshots are not supported in this initial slice.',
    };
  }

  private normalizeBaseUrl() {
    const candidate = this.provider.baseUrl?.trim() || 'https://example.invalid';
    return candidate.replace(/\/+$/, '');
  }

  private buildSearchUrl(query: string, page: number) {
    const endpoint = `${this.normalizeBaseUrl()}/search`; // initial pica slice endpoint
    const params = new URLSearchParams({ q: query, page: String(page), limit: String(DEFAULT_PAGE_SIZE) });
    return `${endpoint}?${params.toString()}`;
  }

  private async fetchJson(url: string): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Pica search request failed with HTTP ${response.status}`);
      }

      return await response.text();
    } finally {
      clearTimeout(timeout);
    }
  }
}
