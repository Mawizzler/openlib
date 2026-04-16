import type { OpacBriefRecord } from '@/src/domain/models/opac';

type PicaHit = {
  id?: string;
  title?: string;
  authors?: string[];
  year?: number | string;
  format?: string;
  detailPath?: string;
  isbn?: string;
};

type PicaSearchEnvelope = {
  total?: number;
  hits?: PicaHit[];
};

export type ParsedPicaSearchResults = {
  total?: number;
  records: OpacBriefRecord[];
};

const parseYear = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return undefined;
  const match = value.match(/\b(1[5-9]\d{2}|20\d{2})\b/);
  if (!match) return undefined;
  const year = Number.parseInt(match[1], 10);
  return Number.isNaN(year) ? undefined : year;
};

const resolveDetailUrl = (baseUrl: string, detailPath?: string): string | undefined => {
  if (!detailPath || typeof detailPath !== 'string') return undefined;
  try {
    return new URL(detailPath, `${baseUrl.replace(/\/+$/, '')}/`).toString();
  } catch {
    return undefined;
  }
};

const toRecord = (hit: PicaHit, index: number, baseUrl: string): OpacBriefRecord | null => {
  const title = typeof hit.title === 'string' ? hit.title.trim() : '';
  if (!title) return null;

  const id = typeof hit.id === 'string' && hit.id.trim() ? hit.id.trim() : `pica-${index}`;
  const authors = Array.isArray(hit.authors)
    ? hit.authors.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
    : [];

  return {
    id,
    title,
    authors,
    publishedYear: parseYear(hit.year),
    format: typeof hit.format === 'string' ? hit.format : undefined,
    detailUrl: resolveDetailUrl(baseUrl, hit.detailPath),
    identifiers:
      typeof hit.isbn === 'string' && hit.isbn.trim()
        ? [{ system: 'isbn', value: hit.isbn.trim() }]
        : undefined,
  };
};

export const parsePicaSearchResults = (
  payload: string,
  baseUrl: string,
): ParsedPicaSearchResults => {
  let parsed: PicaSearchEnvelope | null = null;
  try {
    parsed = JSON.parse(payload) as PicaSearchEnvelope;
  } catch {
    return { records: [] };
  }

  const hits = Array.isArray(parsed?.hits) ? parsed.hits : [];
  const records = hits
    .map((hit, index) => toRecord(hit, index, baseUrl))
    .filter((record): record is OpacBriefRecord => record !== null);

  return {
    total: typeof parsed?.total === 'number' ? parsed.total : undefined,
    records,
  };
};
