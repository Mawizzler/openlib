import type { OpacBriefRecord } from '@/src/domain/models/opac';

type ParsedSearchResults = {
  records: OpacBriefRecord[];
  total?: number;
};

// TODO: Expand selectors per-installation once we capture real SISIS HTML samples.
const DETAIL_HREF_HINTS = [/singleHit\.do/i, /showHit/i, /record/i, /item/i];

const HTML_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': ' ',
};

const normalizeBaseUrl = (baseUrl: string) => baseUrl.replace(/\/+$/, '');

const decodeHtmlEntities = (value: string) => {
  let decoded = value.replace(/&[a-z]+;|&#\d+;|&#x[0-9a-fA-F]+;/g, (entity) => {
    if (HTML_ENTITIES[entity]) {
      return HTML_ENTITIES[entity];
    }
    if (entity.startsWith('&#x')) {
      const code = Number.parseInt(entity.slice(3, -1), 16);
      return Number.isNaN(code) ? entity : String.fromCharCode(code);
    }
    if (entity.startsWith('&#')) {
      const code = Number.parseInt(entity.slice(2, -1), 10);
      return Number.isNaN(code) ? entity : String.fromCharCode(code);
    }
    return entity;
  });

  decoded = decoded.replace(/\s+/g, ' ').trim();
  return decoded;
};

const stripHtml = (value: string) => decodeHtmlEntities(value.replace(/<[^>]*>/g, ' '));

const resolveUrl = (baseUrl: string, href: string) => {
  try {
    return new URL(href, `${normalizeBaseUrl(baseUrl)}/`).toString();
  } catch {
    return null;
  }
};

const extractAnchors = (html: string) => {
  const anchors: { href: string; text: string; raw: string }[] = [];
  const regex = /<a\s+[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null = null;

  while ((match = regex.exec(html)) !== null) {
    anchors.push({
      href: match[1],
      text: stripHtml(match[2]),
      raw: match[0],
    });
  }

  return anchors;
};

const extractBlocks = (html: string) => {
  const blocks: string[] = [];
  const patterns = [
    /<tr[^>]*(?:class|id)=["'][^"']*(?:hit|result|record)[^"']*["'][^>]*>[\s\S]*?<\/tr>/gi,
    /<li[^>]*(?:class|id)=["'][^"']*(?:hit|result|record)[^"']*["'][^>]*>[\s\S]*?<\/li>/gi,
    /<div[^>]*(?:class|id)=["'][^"']*(?:hit|result|record)[^"']*["'][^>]*>[\s\S]*?<\/div>/gi,
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null = null;
    while ((match = pattern.exec(html)) !== null) {
      blocks.push(match[0]);
    }
  }

  return blocks;
};

const extractTotal = (html: string): number | undefined => {
  const patterns = [
    /(?:Treffer|Hits|Results|Resultate|Ergebnisse)[^0-9]{0,10}([0-9]{1,7})/i,
    /([0-9]{1,7})\s*(?:Treffer|Hits|Results|Resultate|Ergebnisse)/i,
    /hitcount[^0-9]{0,10}([0-9]{1,7})/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) {
      const value = Number.parseInt(match[1], 10);
      if (!Number.isNaN(value)) {
        return value;
      }
    }
  }

  return undefined;
};

const extractRecordIdFromUrl = (detailUrl: string | null) => {
  if (!detailUrl) return null;
  try {
    const url = new URL(detailUrl);
    const keys = ['identifier', 'id', 'recordId', 'docId', 'ppn', 'sysno', 'itemId', 'titleId', 'hitId'];
    for (const key of keys) {
      const value = url.searchParams.get(key);
      if (value) return value;
    }
    const lastSegment = url.pathname.split('/').filter(Boolean).pop();
    return lastSegment ?? null;
  } catch {
    return null;
  }
};

const extractAuthors = (block: string) => {
  const authorPatterns = [
    /class=["'][^"']*(?:author|verfasser|autor)[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/i,
    /(?:Verfasser|Autor)\s*[:\-]?\s*<\/?[^>]*>\s*([^<]{2,200})/i,
  ];
  for (const pattern of authorPatterns) {
    const match = block.match(pattern);
    if (match) {
      const text = stripHtml(match[1]);
      if (text) {
        return text.split(/\s*;\s*|\s*\/\s*|\s*\|\s*/).map((item) => item.trim()).filter(Boolean);
      }
    }
  }
  return [];
};

const extractTitle = (block: string, fallback: string) => {
  const patterns = [
    /class=["'][^"']*(?:title|titel)[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/i,
    /<h\d[^>]*>([\s\S]*?)<\/h\d>/i,
  ];

  for (const pattern of patterns) {
    const match = block.match(pattern);
    if (match) {
      const title = stripHtml(match[1]);
      if (title) {
        return title;
      }
    }
  }

  return fallback;
};

const chooseDetailAnchor = (anchors: { href: string; text: string }[]) => {
  if (anchors.length === 0) return null;
  const preferred = anchors.find((anchor) => DETAIL_HREF_HINTS.some((hint) => hint.test(anchor.href)));
  return preferred ?? anchors[0];
};

const parseBlock = (block: string, baseUrl: string, index: number): OpacBriefRecord | null => {
  const anchors = extractAnchors(block);
  const chosen = chooseDetailAnchor(anchors);
  if (!chosen) return null;

  const detailUrl = resolveUrl(baseUrl, chosen.href);
  const recordIdFromUrl = extractRecordIdFromUrl(detailUrl);
  const recordId = recordIdFromUrl ?? `hit-${index + 1}`;
  const title = extractTitle(block, chosen.text || `Result ${index + 1}`);
  const authors = extractAuthors(block);

  return {
    id: recordId,
    title,
    authors,
    detailUrl: detailUrl ?? undefined,
    identifiers: recordIdFromUrl ? [{ system: 'local', value: recordIdFromUrl }] : undefined,
  };
};

const parseAnchorsFallback = (html: string, baseUrl: string) => {
  const anchors = extractAnchors(html).filter((anchor) => anchor.text.length > 1);
  const results: OpacBriefRecord[] = [];

  for (const [index, anchor] of anchors.entries()) {
    if (!DETAIL_HREF_HINTS.some((hint) => hint.test(anchor.href))) {
      continue;
    }
    const detailUrl = resolveUrl(baseUrl, anchor.href);
    const recordIdFromUrl = extractRecordIdFromUrl(detailUrl);
    const recordId = recordIdFromUrl ?? `hit-${index + 1}`;
    const title = anchor.text || `Result ${index + 1}`;

    results.push({
      id: recordId,
      title,
      authors: [],
      detailUrl: detailUrl ?? undefined,
      identifiers: recordIdFromUrl ? [{ system: 'local', value: recordIdFromUrl }] : undefined,
    });
  }

  return results;
};

export const parseSisisSearchResults = (html: string, baseUrl: string): ParsedSearchResults => {
  const total = extractTotal(html);
  const blocks = extractBlocks(html);
  const records: OpacBriefRecord[] = [];

  if (blocks.length > 0) {
    blocks.forEach((block, index) => {
      const record = parseBlock(block, baseUrl, index);
      if (record) {
        records.push(record);
      }
    });
  }

  if (records.length === 0) {
    records.push(...parseAnchorsFallback(html, baseUrl));
  }

  return { records, total };
};
