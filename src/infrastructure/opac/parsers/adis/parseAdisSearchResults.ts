import type { OpacRecord } from '@/src/domain/models/opac';

type AdisRawRecord = {
  id?: unknown;
  title?: unknown;
  author?: unknown;
  year?: unknown;
  format?: unknown;
  detailUrl?: unknown;
};

type AdisSearchPayload = {
  total?: unknown;
  records?: unknown;
  result?: unknown;
  data?: unknown;
  items?: unknown;
  hits?: unknown;
};

type AdisParsedSearchResult = {
  total: number;
  records: OpacRecord[];
};

const toNonEmptyString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const toYear = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) return value;
  if (typeof value === 'string') {
    const match = value.match(/\b(1[5-9]\d{2}|20\d{2})\b/);
    if (match) {
      const year = Number.parseInt(match[1], 10);
      return Number.isNaN(year) ? undefined : year;
    }
  }
  return undefined;
};

const buildDetailUrl = (baseUrl?: string, id?: string, rawDetailUrl?: string): string | undefined => {
  const detailUrl = toNonEmptyString(rawDetailUrl);
  if (detailUrl) return detailUrl;
  if (!baseUrl || !id) return undefined;
  return `${baseUrl.replace(/\/+$/, '')}/Record/${encodeURIComponent(id)}`;
};

const parseRecord = (record: AdisRawRecord, index: number, baseUrl?: string): OpacRecord | null => {
  const id = toNonEmptyString(record.id) ?? `adis-${index + 1}`;
  const title = toNonEmptyString(record.title);

  if (!title) {
    return null;
  }

  const author = toNonEmptyString(record.author);

  return {
    id,
    title,
    authors: author ? [author] : [],
    publishedYear: toYear(record.year),
    format: toNonEmptyString(record.format),
    detailUrl: buildDetailUrl(baseUrl, id, record.detailUrl),
    raw: record as Record<string, unknown>,
  };
};

export const parseAdisSearchResults = (
  payload: AdisSearchPayload,
  baseUrl?: string,
): AdisParsedSearchResult => {
  const nestedPayloads = [payload, payload.data, payload.result].filter(
    (candidate): candidate is AdisSearchPayload => Boolean(candidate && typeof candidate === 'object'),
  );

  const sourceRecords =
    nestedPayloads
      .map((candidate) => {
        if (Array.isArray(candidate.records)) return candidate.records as AdisRawRecord[];
        if (Array.isArray(candidate.items)) return candidate.items as AdisRawRecord[];
        if (Array.isArray(candidate.hits)) return candidate.hits as AdisRawRecord[];
        return [];
      })
      .find((records) => records.length > 0) ?? [];

  const records = sourceRecords
    .map((record, index) => parseRecord(record, index, baseUrl))
    .filter((record): record is OpacRecord => record !== null);

  const total =
    nestedPayloads
      .map((candidate) => candidate.total)
      .find((value): value is number => typeof value === 'number' && Number.isFinite(value)) ?? records.length;

  return { total, records };
};
