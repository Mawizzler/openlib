import type {
  OpacAvailability,
  OpacRecord,
  OpacSearchQuery,
  OpacSearchResult,
} from '@/src/domain/models/opac';

export interface OpacAdapter {
  search(query: OpacSearchQuery): Promise<OpacSearchResult>;
  getRecord(recordId: string): Promise<OpacRecord | null>;
  getAvailability(recordId: string): Promise<OpacAvailability>;
}
