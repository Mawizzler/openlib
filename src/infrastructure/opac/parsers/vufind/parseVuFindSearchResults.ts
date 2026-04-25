import type { OpacBriefRecord } from '@/src/domain/models/opac';

type ParsedSearchResults = {
  records: OpacBriefRecord[];
  total?: number;
};

const DETAIL_HREF_HINTS = [/\/Record\//i, /Record\?id=/i, /recordId=/i, /\/record\//i];

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

const extractAttribute = (block: string, attribute: string): string | null => {
  const pattern = new RegExp(`${attribute}\\s*=\\s*["']([^"']+)["']`, 'i');
  const match = block.match(pattern);
  return match ? match[1] : null;
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
    /<(div|li|article)[^>]*(?:class|id)=["'][^"']*(?:result|record|search-result|result-item|media|list-group-item)[^"']*["'][^>]*>[\s\S]*?<\/\1>/gi,
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
    /Showing\s+\d+\s*-\s*\d+\s+of\s+([0-9,.]+)/i,
    /Results\s+\d+\s*-\s*\d+\s+of\s+([0-9,.]+)/i,
    /of\s+([0-9,.]+)\s+results/i,
    /([0-9,.]+)\s+results/i,
    /result-count[^0-9]{0,10}([0-9,.]+)/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) {
      const normalized = match[1].replace(/,/g, '');
      const value = Number.parseInt(normalized, 10);
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
    const keys = ['id', 'recordId', 'record', 'docId', 'bibId', 'source'];
    for (const key of keys) {
      const value = url.searchParams.get(key);
      if (value) return value;
    }
    const recordMatch = url.pathname.match(/\/Record\/([^/?#]+)/i);
    if (recordMatch?.[1]) return recordMatch[1];
    const lastSegment = url.pathname.split('/').filter(Boolean).pop();
    return lastSegment ?? null;
  } catch {
    return null;
  }
};

const extractAuthors = (block: string) => {
  const authors: string[] = [];
  const pattern = /<a[^>]*class=["'][^"']*(?:author|creator)[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null = null;

  while ((match = pattern.exec(block)) !== null) {
    const text = stripHtml(match[1]);
    if (text) authors.push(text);
  }

  if (authors.length === 0) {
    const fallbackPatterns = [
      /class=["'][^"']*(?:author|creator)[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/i,
      /(?:Author|Authors|Creator|Creators)\s*[:\-]?\s*<\/?[^>]*>\s*([^<]{2,200})/i,
    ];
    for (const fallback of fallbackPatterns) {
      const fallbackMatch = block.match(fallback);
      if (fallbackMatch) {
        const text = stripHtml(fallbackMatch[1]);
        if (text) {
          authors.push(
            ...text
              .split(/\s*;\s*|\s*\/\s*|\s*\|\s*|\s*,\s*/)
              .map((item) => item.trim())
              .filter(Boolean),
          );
          break;
        }
      }
    }
  }

  return Array.from(new Set(authors));
};

const extractTitle = (block: string, fallback: string) => {
  const patterns = [
    /<a[^>]*class=["'][^"']*(?:title|record-title|result-title)[^"']*["'][^>]*>([\s\S]*?)<\/a>/i,
    /class=["'][^"']*(?:title|record-title|result-title)[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/i,
    /<h\d[^>]*>([\s\S]*?)<\/h\d>/i,
  ];

  for (const pattern of patterns) {
    const match = block.match(pattern);
    if (match) {
      const title = stripHtml(match[1]);
      if (title) return title;
    }
  }

  return fallback;
};

const extractFormat = (block: string) => {
  const patterns = [
    /class=["'][^"']*(?:format|iconlabel|recordformat|media)[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/i,
    /(?:Format|Type)\s*[:\-]?\s*<\/?[^>]*>\s*([^<]{2,80})/i,
  ];
  for (const pattern of patterns) {
    const match = block.match(pattern);
    if (match) {
      const text = stripHtml(match[1]);
      if (text) return text;
    }
  }
  return undefined;
};

const extractPublishedYear = (block: string) => {
  const patterns = [
    /class=["'][^"']*(?:publishDate|publication-date|year|date)[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/i,
    /(?:Published|Publication|Year|Date)\s*[:\-]?\s*<\/?[^>]*>\s*([^<]{2,40})/i,
    /\b(1[5-9]\d{2}|20\d{2})\b/,
  ];
  for (const pattern of patterns) {
    const match = block.match(pattern);
    if (match) {
      const value = match[1] ?? match[0];
      const text = stripHtml(value);
      const yearMatch = text.match(/\b(1[5-9]\d{2}|20\d{2})\b/);
      if (yearMatch) {
        const year = Number.parseInt(yearMatch[1], 10);
        if (!Number.isNaN(year)) return year;
      }
    }
  }
  return undefined;
};

const extractCoverUrl = (block: string, baseUrl: string) => {
  const patterns = [
    /<img[^>]*class=["'][^"']*(?:recordcover|cover|result-cover|media-object)[^"']*["'][^>]*>/i,
    /<img[^>]*data-src=["'][^"']+["'][^>]*>/i,
    /<img[^>]*src=["'][^"']+["'][^>]*>/i,
  ];
  for (const pattern of patterns) {
    const match = block.match(pattern);
    if (match) {
      const tag = match[0];
      const src = extractAttribute(tag, 'data-src') ?? extractAttribute(tag, 'src');
      if (src) return resolveUrl(baseUrl, src) ?? src;
    }
  }
  return undefined;
};

const chooseDetailAnchor = (anchors: { href: string; text: string }[]) => {
  if (anchors.length === 0) return null;
  const preferred = anchors.find((anchor) => DETAIL_HREF_HINTS.some((hint) => hint.test(anchor.href)));
  return preferred ?? anchors[0];
};

const extractRecordIdFromBlock = (block: string) => {
  const candidates = [
    extractAttribute(block, 'data-record-id'),
    extractAttribute(block, 'data-id'),
    extractAttribute(block, 'data-recordid'),
    extractAttribute(block, 'data-record'),
  ];

  return candidates.find((value) => value && value.trim()) ?? null;
};

const parseBlock = (block: string, baseUrl: string, index: number): OpacBriefRecord | null => {
  const anchors = extractAnchors(block);
  const chosen = chooseDetailAnchor(anchors);
  const detailUrlCandidate =
    extractAttribute(block, 'data-record-url') ??
    extractAttribute(block, 'data-href') ??
    chosen?.href ??
    null;
  const recordIdFromBlock = extractRecordIdFromBlock(block);

  if (!detailUrlCandidate && !recordIdFromBlock) {
    return null;
  }

  const detailUrl = detailUrlCandidate ? resolveUrl(baseUrl, detailUrlCandidate) : null;
  const recordIdFromUrl = extractRecordIdFromUrl(detailUrl);
  const recordId = recordIdFromBlock ?? recordIdFromUrl ?? `vufind-hit-${index + 1}`;
  const title = extractTitle(block, chosen?.text || `Result ${index + 1}`);
  const authors = extractAuthors(block);
  const publishedYear = extractPublishedYear(block);
  const format = extractFormat(block);
  const coverUrl = extractCoverUrl(block, baseUrl);

  return {
    id: recordId,
    title,
    authors,
    detailUrl: detailUrl ?? undefined,
    publishedYear,
    format,
    coverUrl,
    identifiers: recordIdFromBlock || recordIdFromUrl ? [{ system: 'local', value: recordId }] : undefined,
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
    const recordId = recordIdFromUrl ?? `vufind-hit-${index + 1}`;
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

export const parseVuFindSearchResults = (
  html: string,
  baseUrl: string,
): ParsedSearchResults => {
  const total = extractTotal(html);
  const blocks = extractBlocks(html);
  const records: OpacBriefRecord[] = [];
  const seen = new Set<string>();

  if (blocks.length > 0) {
    blocks.forEach((block, index) => {
      const record = parseBlock(block, baseUrl, index);
      if (record && !seen.has(record.id)) {
        records.push(record);
        seen.add(record.id);
      }
    });
  }

  if (records.length === 0) {
    parseAnchorsFallback(html, baseUrl).forEach((record) => {
      if (!seen.has(record.id)) {
        records.push(record);
        seen.add(record.id);
      }
    });
  }

  return { records, total };
};
