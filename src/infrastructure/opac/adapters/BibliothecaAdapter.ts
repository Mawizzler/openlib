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

const DEFAULT_PAGE_SIZE = 20;

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');

const buildCandidateSearchUrls = (baseUrl: string, query: string, page: number): string[] => {
  const q = encodeURIComponent(query.trim());
  const startHit = Math.max(1, (page - 1) * DEFAULT_PAGE_SIZE + 1);
  const root = trimTrailingSlash(baseUrl);
  const lowerRoot = root.toLowerCase();

  const roots = [
    root,
    ...(lowerRoot.includes('/webopac') ? [] : [`${root}/webopac`]),
    ...(lowerRoot.includes('/mediensuche') ? [] : [`${root}/Mediensuche`]),
  ];

  const urls: string[] = [];
  for (const candidateRoot of roots) {
    const normalizedRoot = trimTrailingSlash(candidateRoot);
    const rootHasMediensuche = normalizedRoot.toLowerCase().endsWith('/mediensuche');
    const medienPrefix = rootHasMediensuche ? normalizedRoot : `${normalizedRoot}/Mediensuche`;

    urls.push(
      `${medienPrefix}/EinfacheSuche?searchhash=&top=y&detail=0&search=${q}`,
      `${medienPrefix}/EinfacheSuche?search=${q}`,
      `${medienPrefix}?search=${q}`,
      `${medienPrefix}/Suche?search=${q}`,
      `${medienPrefix}/Suchergebnis?search=${q}&startHit=${startHit}`,
      `${medienPrefix}/Suchergebnis?search=${q}`,
      `${normalizedRoot}/EinfacheSuche?searchhash=&top=y&detail=0&search=${q}`,
      `${normalizedRoot}/EinfacheSuche?search=${q}`,
      `${normalizedRoot}/Suche?search=${q}`,
      `${normalizedRoot}/Suchergebnis?search=${q}&startHit=${startHit}`,
      `${normalizedRoot}/Suchergebnis?search=${q}`,
    );
  }

  return [...new Set(urls)];
};

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

    const candidateUrls = buildCandidateSearchUrls(baseUrl, query, page);
    let lastError: string | undefined;

    for (const url of candidateUrls) {
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
