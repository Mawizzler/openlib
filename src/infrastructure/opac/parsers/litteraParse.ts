import type { OpacBriefRecord } from '@/src/domain/models/opac';

type LitteraListItem = {
  id?: string | number;
  title?: string;
  author?: string;
  year?: string | number;
  detailUrl?: string;
};

type LitteraSearchEnvelope = {
  total?: number;
  items?: LitteraListItem[];
};

export type ParsedLitteraSearchResults = {
  total?: number;
  records: OpacBriefRecord[];
};

const toAuthors = (author?: string): string[] => {
  if (!author) return [];
  return author
    .split(/,|;|\band\b/gi)
    .map((value) => value.trim())
    .filter(Boolean);
};

const toPublishedYear = (year?: string | number): number | undefined => {
  if (typeof year === 'number' && Number.isFinite(year)) return year;
  if (typeof year !== 'string') return undefined;
  const match = year.match(/(\d{4})/);
  if (!match) return undefined;
  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const toRecord = (item: LitteraListItem, index: number): OpacBriefRecord | null => {
  const title = (item.title ?? '').trim();
  if (!title) return null;

  const rawId = item.id;
  const id = rawId === undefined || rawId === null ? `littera-${index}` : String(rawId);

  return {
    id,
    title,
    authors: toAuthors(item.author),
    publishedYear: toPublishedYear(item.year),
    detailUrl: item.detailUrl,
  };
};

export const parseLitteraSearchResults = (payload: string): ParsedLitteraSearchResults => {
  let parsed: LitteraSearchEnvelope | null = null;
  try {
    parsed = JSON.parse(payload) as LitteraSearchEnvelope;
  } catch {
    return { records: [] };
  }

  const items = Array.isArray(parsed?.items) ? parsed.items : [];
  const records = items
    .map((item, index) => toRecord(item, index))
    .filter((record): record is OpacBriefRecord => record !== null);

  return {
    total: typeof parsed?.total === 'number' ? parsed.total : undefined,
    records,
  };
};
