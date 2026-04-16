import type { OpacBriefRecord } from '@/src/domain/models/opac';

type OpenApiDoc = {
  key?: string;
  title?: string;
  author_name?: string[];
  first_publish_year?: number;
  cover_i?: number;
  edition_key?: string[];
  isbn?: string[];
  type?: string;
};

type OpenApiResponse = {
  numFound?: number;
  docs?: OpenApiDoc[];
};

export type ParsedOpenSearchResults = {
  total?: number;
  records: OpacBriefRecord[];
};

const toDetailUrl = (doc: OpenApiDoc, baseUrl: string): string | undefined => {
  if (doc.key && doc.key.startsWith('/')) {
    return `${baseUrl}${doc.key}`;
  }
  const fallbackEdition = doc.edition_key?.[0];
  if (!fallbackEdition) return undefined;
  return `${baseUrl}/books/${encodeURIComponent(fallbackEdition)}`;
};

const toCoverUrl = (coverId?: number): string | undefined => {
  if (!coverId || !Number.isFinite(coverId)) return undefined;
  return `https://covers.openlibrary.org/b/id/${coverId}-M.jpg`;
};

const parseDocToRecord = (doc: OpenApiDoc, index: number, baseUrl: string): OpacBriefRecord | null => {
  const title = (doc.title ?? '').trim();
  if (!title) return null;

  const key = typeof doc.key === 'string' ? doc.key : '';
  const edition = doc.edition_key?.[0];
  const id = key || edition || `open-${index}`;

  return {
    id,
    title,
    authors: Array.isArray(doc.author_name) ? doc.author_name.filter(Boolean) : [],
    detailUrl: toDetailUrl(doc, baseUrl),
    publishedYear: typeof doc.first_publish_year === 'number' ? doc.first_publish_year : undefined,
    format: doc.type === 'work' ? 'Work' : undefined,
    coverUrl: toCoverUrl(doc.cover_i),
    identifiers: Array.isArray(doc.isbn)
      ? doc.isbn.slice(0, 3).map((value) => ({ system: 'isbn' as const, value }))
      : undefined,
  };
};

export const parseOpenSearchResults = (
  payload: string,
  baseUrl = 'https://openlibrary.org',
): ParsedOpenSearchResults => {
  let parsed: OpenApiResponse | null = null;
  try {
    parsed = JSON.parse(payload) as OpenApiResponse;
  } catch {
    return { records: [] };
  }

  const docs = Array.isArray(parsed?.docs) ? parsed.docs : [];
  const records = docs
    .map((doc, index) => parseDocToRecord(doc, index, baseUrl))
    .filter((record): record is OpacBriefRecord => record !== null);

  return {
    total: typeof parsed?.numFound === 'number' ? parsed.numFound : undefined,
    records,
  };
};
