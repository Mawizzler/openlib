import type {
  LibrarySystemAdapter,
  LibraryAccountLoginInput,
  LibraryAccountLoginResult,
  LibraryAccountSnapshotResult,
  LibrarySystemSearchInput,
} from '@/src/application/ports/LibrarySystemAdapter';
import type { OpacAvailability, OpacRecord, OpacSearchResult } from '@/src/domain/models/opac';
import type { OpacappNormalizedProvider } from '@/src/domain/models/opacapp';
import { parsePrimoSearchResults } from '@/src/infrastructure/opac/parsers/primo/parsePrimoSearchResults';

const DEFAULT_PAGE_SIZE = 20;
const DEFAULT_TIMEOUT_MS = 8000;

export class PrimoAdapter implements LibrarySystemAdapter {
  readonly system = 'primo';
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
      const parsed = parsePrimoSearchResults(payload, this.normalizeBaseUrl());

      return {
        total: parsed.total ?? parsed.records.length,
        page,
        pageSize: DEFAULT_PAGE_SIZE,
        records: parsed.records,
      };
    } catch (error) {
      console.warn('[PrimoAdapter] search failed', error);
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
      message: 'Primo adapter account login is not supported in this initial slice.',
    };
  }

  async fetchAccountSnapshot(): Promise<LibraryAccountSnapshotResult> {
    return {
      status: 'not_supported',
      message: 'Primo adapter account snapshots are not supported in this initial slice.',
    };
  }

  private normalizeBaseUrl() {
    const candidate = this.provider.baseUrl?.trim() || 'https://example.invalid';
    return candidate.replace(/\/+$/, '');
  }

  private buildSearchUrl(query: string, page: number) {
    const endpoint = `${this.normalizeBaseUrl()}/primo_library/libweb/action/search.do`;
    const params = new URLSearchParams({
      fn: 'search',
      mode: 'Basic',
      vid: 'default',
      tab: 'default_tab',
      dum: 'true',
      indx: String(Math.max(1, page - 1) * DEFAULT_PAGE_SIZE + 1),
      bulkSize: String(DEFAULT_PAGE_SIZE),
      ['vl(freeText0)']: query,
    });
    return `${endpoint}?${params.toString()}`;
  }

  private async fetchJson(url: string): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        headers: {
          Accept: 'application/json,text/plain;q=0.9,*/*;q=0.8',
          'X-Requested-With': 'XMLHttpRequest',
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Primo search request failed with HTTP ${response.status}`);
      }

      return await response.text();
    } finally {
      clearTimeout(timeout);
    }
  }
}
