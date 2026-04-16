import type { OpacBriefRecord } from '@/src/domain/models/opac';

type PrimoPnx = {
  control?: {
    recordid?: string[];
    sourceid?: string[];
  };
  display?: {
    title?: string[];
    creator?: string[];
    publisher?: string[];
    creationdate?: string[];
    type?: string[];
    language?: string[];
  };
  links?: {
    linktorsrc?: string[];
  };
};

type PrimoDoc = {
  pnx?: PrimoPnx;
};

type PrimoResponse = {
  info?: {
    total?: number;
  };
  docs?: PrimoDoc[];
};

const normalizeArrayValue = (value?: string[]) => {
  if (!Array.isArray(value) || value.length === 0) return undefined;
  const candidate = value[0]?.trim();
  return candidate || undefined;
};

const toRecord = (doc: PrimoDoc, baseUrl: string): OpacBriefRecord | null => {
  const pnx = doc.pnx;
  if (!pnx) return null;

  const recordId = normalizeArrayValue(pnx.control?.recordid);
  if (!recordId) return null;

  const title = normalizeArrayValue(pnx.display?.title) ?? 'Untitled';
  const creator = normalizeArrayValue(pnx.display?.creator);
  const publisher = normalizeArrayValue(pnx.display?.publisher);
  const year = normalizeArrayValue(pnx.display?.creationdate);
  const materialType = normalizeArrayValue(pnx.display?.type);
  const language = normalizeArrayValue(pnx.display?.language);
  const sourceId = normalizeArrayValue(pnx.control?.sourceid);

  const directLink = normalizeArrayValue(pnx.links?.linktorsrc);
  const fallbackDetail = `${baseUrl}/primo_library/libweb/action/display.do?doc=${encodeURIComponent(recordId)}`;

  return {
    id: recordId,
    title,
    authors: creator ? [creator] : [],
    year,
    publisher,
    format: materialType,
    language,
    source: sourceId ?? 'primo',
    detailUrl: directLink ?? fallbackDetail,
    availabilityLabel: undefined,
  };
};

export const parsePrimoSearchResults = (payload: string, baseUrl: string) => {
  let decoded: PrimoResponse | null = null;

  try {
    decoded = JSON.parse(payload) as PrimoResponse;
  } catch {
    return { total: 0, records: [] as OpacBriefRecord[] };
  }

  const docs = Array.isArray(decoded.docs) ? decoded.docs : [];
  const records = docs.map((doc) => toRecord(doc, baseUrl)).filter((record): record is OpacBriefRecord => Boolean(record));

  const total = typeof decoded.info?.total === 'number' ? decoded.info.total : records.length;

  return {
    total,
    records,
  };
};
