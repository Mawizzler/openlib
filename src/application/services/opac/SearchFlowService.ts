import type { LibrarySystemSearchInput } from '@/src/application/ports/LibrarySystemAdapter';
import type { OpacSearchResult } from '@/src/domain/models/opac';
import type { OpacappNormalizedProvider } from '@/src/domain/models/opacapp';
import { createLibrarySystemAdapter } from '@/src/infrastructure/opac/AdapterRegistry';

export class SearchFlowService {
  async search(
    provider: OpacappNormalizedProvider,
    input: LibrarySystemSearchInput,
  ): Promise<OpacSearchResult> {
    const adapter = createLibrarySystemAdapter(provider);
    return adapter.search(input);
  }
}
