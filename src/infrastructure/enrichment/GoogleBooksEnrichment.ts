import type { OpacBriefRecord, OpacIdentifier, OpacRecord } from '@/src/domain/models/opac';

type GoogleBooksVolume = {
  coverUrl?: string;
  title?: string;
  authors?: string[];
  publisher?: string;
  publishedYear?: number;
  description?: string;
  language?: string;
  categories?: string[];
};

const DEFAULT_MAX_REQUESTS = 20;

const normalizeIsbn = (value: string): string | null => {
  const normalized = value.replace(/[^0-9Xx]/g, '').toUpperCase();
  if (normalized.length === 10 || normalized.length === 13) {
    return normalized;
  }
  return null;
};

const pickIsbn = (identifiers?: OpacIdentifier[]): string | null => {
  if (!identifiers) return null;
  const isbnCandidates = identifiers
    .filter((entry) => entry.system === 'isbn')
    .map((entry) => normalizeIsbn(entry.value))
    .filter((value): value is string => Boolean(value));
  if (isbnCandidates.length === 0) return null;
  const isbn13 = isbnCandidates.find((value) => value.length === 13);
  return isbn13 ?? isbnCandidates[0];
};

const normalizeCoverUrl = (value?: string): string | undefined => {
  if (!value) return undefined;
  if (value.startsWith('http://')) {
    return `https://${value.slice('http://'.length)}`;
  }
  return value;
};

const parsePublishedYear = (value?: string): number | undefined => {
  if (!value) return undefined;
  const match = value.match(/\d{4}/);
  if (!match) return undefined;
  const parsed = Number.parseInt(match[0], 10);
  if (Number.isNaN(parsed)) return undefined;
  return parsed;
};

const mergeBriefRecord = (record: OpacBriefRecord, volume: GoogleBooksVolume): OpacBriefRecord => {
  const title = record.title?.trim() ? record.title : volume.title ?? record.title;
  const authors = record.authors?.length ? record.authors : volume.authors ?? record.authors;

  return {
    ...record,
    coverUrl: record.coverUrl ?? volume.coverUrl,
    title,
    authors,
    publisher: record.publisher ?? volume.publisher,
    publishedYear: record.publishedYear ?? volume.publishedYear,
    language: record.language ?? volume.language,
  };
};

const mergeRecord = (record: OpacRecord, volume: GoogleBooksVolume): OpacRecord => {
  const title = record.title?.trim() ? record.title : volume.title ?? record.title;
  const authors = record.authors?.length ? record.authors : volume.authors ?? record.authors;
  const subjects = record.subjects?.length ? record.subjects : volume.categories ?? record.subjects;

  return {
    ...record,
    coverUrl: record.coverUrl ?? volume.coverUrl,
    title,
    authors,
    publisher: record.publisher ?? volume.publisher,
    publishedYear: record.publishedYear ?? volume.publishedYear,
    description: record.description ?? volume.description,
    language: record.language ?? volume.language,
    subjects,
  };
};

class GoogleBooksEnrichmentService {
  private cache = new Map<string, GoogleBooksVolume | null>();
  private requestCount = 0;

  constructor(private maxRequests: number = DEFAULT_MAX_REQUESTS) {}

  async enrichBriefRecords(records: OpacBriefRecord[]): Promise<OpacBriefRecord[]> {
    const enriched: OpacBriefRecord[] = [];
    for (const record of records) {
      enriched.push(await this.enrichBriefRecord(record));
    }
    return enriched;
  }

  async enrichBriefRecord(record: OpacBriefRecord): Promise<OpacBriefRecord> {
    if (record.coverUrl) return record;
    const isbn = pickIsbn(record.identifiers);
    if (!isbn) return record;
    const volume = await this.fetchByIsbn(isbn);
    if (!volume) return record;
    return mergeBriefRecord(record, volume);
  }

  async enrichRecord(record: OpacRecord): Promise<OpacRecord> {
    if (record.coverUrl) return record;
    const isbn = pickIsbn(record.identifiers);
    if (!isbn) return record;
    const volume = await this.fetchByIsbn(isbn);
    if (!volume) return record;
    return mergeRecord(record, volume);
  }

  private async fetchByIsbn(isbn: string): Promise<GoogleBooksVolume | null> {
    const cached = this.cache.get(isbn);
    if (cached !== undefined) return cached;
    if (this.requestCount >= this.maxRequests) {
      return null;
    }

    this.requestCount += 1;

    try {
      const url = new URL('https://www.googleapis.com/books/v1/volumes');
      url.searchParams.set('q', `isbn:${isbn}`);

      const response = await fetch(url.toString());
      if (!response.ok) {
        this.cache.set(isbn, null);
        return null;
      }

      const payload = (await response.json()) as {
        items?: Array<{
          volumeInfo?: {
            title?: string;
            authors?: string[];
            publisher?: string;
            publishedDate?: string;
            description?: string;
            language?: string;
            categories?: string[];
            imageLinks?: {
              thumbnail?: string;
              smallThumbnail?: string;
            };
          };
        }>;
      };

      const volumeInfo = payload.items?.[0]?.volumeInfo;
      if (!volumeInfo) {
        this.cache.set(isbn, null);
        return null;
      }

      const coverUrl = normalizeCoverUrl(
        volumeInfo.imageLinks?.thumbnail ?? volumeInfo.imageLinks?.smallThumbnail,
      );

      const volume: GoogleBooksVolume = {
        coverUrl,
        title: volumeInfo.title,
        authors: volumeInfo.authors,
        publisher: volumeInfo.publisher,
        publishedYear: parsePublishedYear(volumeInfo.publishedDate),
        description: volumeInfo.description,
        language: volumeInfo.language,
        categories: volumeInfo.categories,
      };

      this.cache.set(isbn, volume);
      return volume;
    } catch (error) {
      this.cache.set(isbn, null);
      return null;
    }
  }
}

let singleton: GoogleBooksEnrichmentService | null = null;

export const googleBooksEnrichment = () => {
  if (!singleton) {
    singleton = new GoogleBooksEnrichmentService();
  }
  return singleton;
};
