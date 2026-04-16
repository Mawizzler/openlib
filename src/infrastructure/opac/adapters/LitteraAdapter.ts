import type {
  LibrarySystemAdapter,
  LibraryAccountLoginInput,
  LibraryAccountLoginResult,
  LibraryAccountSnapshotResult,
  LibrarySystemSearchInput,
} from '@/src/application/ports/LibrarySystemAdapter';
import type { OpacAvailability, OpacRecord, OpacSearchResult } from '@/src/domain/models/opac';
import type { OpacappNormalizedProvider } from '@/src/domain/models/opacapp';
import { parseLitteraSearchResults } from '@/src/infrastructure/opac/parsers/litteraParse';

const DEFAULT_PAGE_SIZE = 20;

export class LitteraAdapter implements LibrarySystemAdapter {
  readonly system = 'littera';
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

    const examplePayload = JSON.stringify({
      total: 1,
      items: [
        {
          id: `${this.provider.id}-stub-${page}`,
          title: `Littera placeholder result for "${query}"`,
          author: this.provider.title,
          year: 2024,
        },
      ],
    });

    const parsed = parseLitteraSearchResults(examplePayload);

    return {
      total: parsed.total ?? parsed.records.length,
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

  async accountLogin(_input: LibraryAccountLoginInput): Promise<LibraryAccountLoginResult> {
    return {
      status: 'not_supported',
      message: 'Littera account login is not supported in this initial slice.',
    };
  }

  async fetchAccountSnapshot(): Promise<LibraryAccountSnapshotResult> {
    return {
      status: 'not_supported',
      message: 'Littera account snapshots are not supported in this initial slice.',
    };
  }
}
