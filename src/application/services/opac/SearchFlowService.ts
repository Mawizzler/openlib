import type { LibrarySystemSearchInput } from '@/src/application/ports/LibrarySystemAdapter';
import type { OpacSearchResult } from '@/src/domain/models/opac';
import type { OpacappNormalizedProvider } from '@/src/domain/models/opacapp';
import { googleBooksEnrichment } from '@/src/infrastructure/enrichment/GoogleBooksEnrichment';
import { createLibrarySystemAdapter } from '@/src/infrastructure/opac/AdapterRegistry';

export class SearchFlowService {
  async search(
    provider: OpacappNormalizedProvider,
    input: LibrarySystemSearchInput,
  ): Promise<OpacSearchResult> {
    const adapter = createLibrarySystemAdapter(provider);
    const result = await adapter.search(input);

    try {
      const enrichment = googleBooksEnrichment();
      const records = await enrichment.enrichBriefRecords(result.records);
      return {
        ...result,
        records,
      };
    } catch (error) {
      console.warn('[SearchFlowService] Google Books enrichment failed', error);
      return result;
    }
  }
}
