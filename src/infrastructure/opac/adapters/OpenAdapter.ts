import type {
  LibrarySystemAdapter,
  LibraryAccountLoginInput,
  LibraryAccountLoginResult,
  LibraryAccountSnapshotResult,
  LibrarySystemSearchInput,
} from '@/src/application/ports/LibrarySystemAdapter';
import type { OpacAvailability, OpacRecord, OpacSearchResult } from '@/src/domain/models/opac';
import type { OpacappNormalizedProvider } from '@/src/domain/models/opacapp';
import { parseOpenSearchResults } from '@/src/infrastructure/opac/parsers/open/parseOpenSearchResults';
import { parseOpenMediensucheResults } from '@/src/infrastructure/opac/parsers/open/parseOpenMediensucheResults';
import { fetchTextWithRetry } from '@/src/infrastructure/opac/transport/fetchWithRetry';
import { normalizeProviderBaseUrl } from '@/src/infrastructure/opac/transport/normalizeProviderBaseUrl';
import {
  buildAdapterFallbackRoutes,
  isHttp404Error,
} from '@/src/infrastructure/opac/transport/adapterFallbackRoutes';

const DEFAULT_PAGE_SIZE = 20;

export class OpenAdapter implements LibrarySystemAdapter {
  readonly system = 'open';
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

    return await this.searchViaFallbackRoutes(query, page);
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
      message: 'Open adapter account login is not supported in this initial slice.',
    };
  }

  async fetchAccountSnapshot(): Promise<LibraryAccountSnapshotResult> {
    return {
      status: 'not_supported',
      message: 'Open adapter account snapshots are not supported in this initial slice.',
    };
  }

  private normalizeBaseUrl() {
    const candidate = this.provider.baseUrl?.trim() || 'https://openlibrary.org';
    return (
      normalizeProviderBaseUrl(candidate, { api: this.system, providerId: this.provider.id }).normalizedUrl ??
      candidate
    ).replace(/\/+$/, '');
  }

  private async fetchJson(url: string): Promise<string> {
    return await fetchTextWithRetry(url, {
      headers: { Accept: 'application/json' },
    });
  }

  private async searchViaFallbackRoutes(query: string, page: number): Promise<OpacSearchResult> {
    const baseUrl = this.normalizeBaseUrl();
    const { candidates } = buildAdapterFallbackRoutes({
      system: this.system,
      baseUrl,
      query,
      page,
      pageSize: DEFAULT_PAGE_SIZE,
      providerId: this.provider.id,
    });
    const attempts: string[] = [];

    for (const candidate of candidates) {
      try {
        if (candidate.route === 'open-search-json') {
          const payload = await this.fetchJson(candidate.url);
          const parsed = parseOpenSearchResults(payload, baseUrl);
          if (!parsed.records.length) {
            continue;
          }
          return {
            total: parsed.total ?? parsed.records.length,
            page,
            pageSize: DEFAULT_PAGE_SIZE,
            records: parsed.records,
          };
        }

        const html = await this.fetchHtml(candidate.url);
        const parsed = parseOpenMediensucheResults(html, baseUrl);
        if (parsed.records.length) {
          return {
            total: parsed.records.length,
            page,
            pageSize: DEFAULT_PAGE_SIZE,
            records: parsed.records,
          };
        }
      } catch (error) {
        if (!isHttp404Error(error)) {
          console.warn('[OpenAdapter] search transport failed', error);
          return { total: 0, page, pageSize: DEFAULT_PAGE_SIZE, records: [] };
        }
        attempts.push(`${candidate.route}: ${candidate.url}`);
      }
    }

    if (attempts.length > 0) {
      console.warn('[OpenAdapter] search fallback routes exhausted after HTTP 404', attempts);
    }
    return { total: 0, page, pageSize: DEFAULT_PAGE_SIZE, records: [] };
  }

  private async fetchHtml(url: string): Promise<string> {
    return await fetchTextWithRetry(url, {
      headers: { Accept: 'text/html,application/xhtml+xml' },
    });
  }
}
