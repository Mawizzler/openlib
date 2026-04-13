import type { OpacAdapter } from '@/src/application/ports/OpacAdapter';
import type {
  OpacAvailability,
  OpacRecord,
  OpacSearchQuery,
  OpacSearchResult,
} from '@/src/domain/models/opac';

export class StubOpacAdapter implements OpacAdapter {
  async search(query: OpacSearchQuery): Promise<OpacSearchResult> {
    return {
      total: 0,
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20,
      records: [],
    };
  }

  async getRecord(_recordId: string): Promise<OpacRecord | null> {
    return null;
  }

  async getAvailability(recordId: string): Promise<OpacAvailability> {
    return {
      recordId,
      availableCount: 0,
      totalCount: 0,
      holdsCount: 0,
    };
  }
}
