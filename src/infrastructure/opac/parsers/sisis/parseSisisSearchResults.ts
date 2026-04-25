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

const extractAttribute = (value: string, attribute: string) => {
  const pattern = new RegExp(`${attribute}\\s*=\\s*["']([^"']+)["']`, 'i');
  const match = value.match(pattern);
  return match ? match[1] : null;
};

const resolveUrl = (baseUrl: string, href: string) => {
  try {
    const decodedHref = href.replace(/&amp;/g, '&');
    return new URL(decodedHref, `${normalizeBaseUrl(baseUrl)}/`).toString();
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

const extractRowBlocks = (html: string) => {
  const marker = '<div class="row border-bottom';
  const blocks: string[] = [];
  let index = html.indexOf(marker);
  if (index === -1) return blocks;
  const indices: number[] = [];
  while (index !== -1) {
    indices.push(index);
    index = html.indexOf(marker, index + marker.length);
  }
  for (let i = 0; i < indices.length; i += 1) {
    const start = indices[i];
    const end = indices[i + 1] ?? html.length;
    blocks.push(html.slice(start, end));
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
    const keys = [
      'identifier',
      'id',
      'recordId',
      'docId',
      'ppn',
      'sysno',
      'itemId',
      'titleId',
      'hitId',
    ];
    const identifier = url.searchParams.get('identifier');
    const curPos = url.searchParams.get('curPos');
    if (identifier && curPos) {
      return `${identifier}:${curPos}`;
    }
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
    /class=["'][^"']*(?:title|titel|recordtitle)[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/i,
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

const formatFromCandidate = (candidate: string) => {
  const normalized = candidate.toLowerCase();
  if (/h(?:ö|oe|o)rbuch|hörspiel|audio[-\s]?book/.test(normalized)) return 'Hörbuch';
  if (/e[-\s]?book|ebook/.test(normalized)) return 'eBook';
  if (/\bdvd\b/.test(normalized)) return 'DVD';
  if (/\bcd\b|cd-rom|audio[-\s]?cd/.test(normalized)) return 'CD';
  if (/\bbuch\b|\bbook\b|gedruckt|print/.test(normalized)) return 'Buch';
  return undefined;
};

const extractFormatFromTitle = (title: string) => {
  const bracketMatch = title.match(/[\[(]\s*(buch|cd|dvd|hörbuch|hoerbuch|e-?book)\s*[\])]/i);
  if (bracketMatch) {
    return formatFromCandidate(bracketMatch[1]);
  }
  const tailMatch = title.match(/\s[-–|:]\s*(buch|cd|dvd|hörbuch|hoerbuch|e-?book)\b/i);
  if (tailMatch) {
    return formatFromCandidate(tailMatch[1]);
  }
  return undefined;
};

const extractFormat = (block: string, title: string) => {
  const candidates: string[] = [];

  const imgRegex = /<img[^>]*>/gi;
  let imgMatch: RegExpExecArray | null = null;
  while ((imgMatch = imgRegex.exec(block)) !== null) {
    const tag = imgMatch[0];
    const alt = extractAttribute(tag, 'alt') ?? extractAttribute(tag, 'title');
    const src = extractAttribute(tag, 'src');
    const className = extractAttribute(tag, 'class');
    if (alt) candidates.push(alt);
    if (className) candidates.push(className);
    if (src) candidates.push(src);
  }

  const dataAttrMatch = block.match(/data-(?:format|type|mediatype|media)\s*=\s*["']([^"']+)["']/i);
  if (dataAttrMatch) {
    candidates.push(dataAttrMatch[1]);
  }

  const labelPatterns = [
    /class=["'][^"']*(?:mediatype|media|format|material|document|iconlabel|type|medienart|medientyp)[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/i,
    /(?:Medienart|Medientyp|Material|Format|Dokumentart|Dokumenttyp|Typ|Medium)\s*[:\-]?\s*<\/?[^>]*>\s*([^<]{2,80})/i,
  ];
  for (const pattern of labelPatterns) {
    const match = block.match(pattern);
    if (match) {
      const text = stripHtml(match[1]);
      if (text) candidates.push(text);
    }
  }

  const titleSignal = extractFormatFromTitle(title);
  if (titleSignal) return titleSignal;

  for (const candidate of candidates) {
    const format = formatFromCandidate(candidate);
    if (format) return format;
  }

  return undefined;
};

const extractAvailabilityLabel = (block: string) => {
  const spanMatch = block.match(
    /<span[^>]*class=["'][^"']*(?:textgruen|textrot|textgelb|textorange|textblue)[^"']*["'][^>]*>([\s\S]*?)<\/span>/i,
  );
  if (spanMatch) {
    const label = stripHtml(spanMatch[1]).replace(/\?{3}[^?]+\?{3}/g, '').trim();
    if (label) return label;
  }

  const statusMatch = block.match(
    /(verf(?:ü|ue)gbar|ausleihbar|entliehen[^<]*|ausgeliehen[^<]*|nicht\s+verf(?:ü|ue)gbar[^<]*|bestellt[^<]*|vormerk[^<]*)/i,
  );
  if (statusMatch) {
    const label = stripHtml(statusMatch[0]).replace(/\?{3}[^?]+\?{3}/g, '').trim();
    if (label) return label;
  }

  return undefined;
};

const extractAvailabilityStatus = (label?: string) => {
  if (!label) return undefined;
  const normalized = label.toLowerCase();
  if (/ausleihbar|verf(?:ü|ue)gbar|available/.test(normalized)) return 'available';
  if (/entliehen|ausgeliehen|nicht\s+verf(?:ü|ue)gbar|checked\s*out/.test(normalized)) return 'checked_out';
  if (/vormerk|reserv|hold|bestellt/.test(normalized)) return 'on_hold';
  if (/in\s+bearbeitung|unterwegs|in\s+transit/.test(normalized)) return 'in_transit';
  return 'unknown';
};

const normalizeIsbn = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const cleaned = trimmed.replace(/^[^\dXx]+|[^\dXx]+$/g, '').replace(/\s+/g, '');
  const digitsOnly = cleaned.replace(/[^0-9Xx]/g, '').toUpperCase();
  if (!(digitsOnly.length === 10 || digitsOnly.length === 13)) {
    return null;
  }
  return cleaned;
};

const extractIsbns = (block: string) => {
  const results = new Set<string>();

  const urlRegex = /isbns?=([^&"'\\s>]+)/gi;
  let urlMatch: RegExpExecArray | null = null;
  while ((urlMatch = urlRegex.exec(block)) !== null) {
    try {
      const decoded = decodeURIComponent(urlMatch[1]);
      decoded
        .replace(/[\[\]]/g, '')
        .split(/[,\s]+/)
        .map((entry) => normalizeIsbn(entry))
        .filter((entry): entry is string => Boolean(entry))
        .forEach((entry) => results.add(entry));
    } catch {
      // Ignore malformed encodings.
    }
  }

  const text = stripHtml(block);
  const textRegex = /ISBN[^0-9Xx]{0,6}([0-9Xx][0-9Xx\\-\\s]{8,16}[0-9Xx])/gi;
  let textMatch: RegExpExecArray | null = null;
  while ((textMatch = textRegex.exec(text)) !== null) {
    const normalized = normalizeIsbn(textMatch[1]);
    if (normalized) results.add(normalized);
  }

  return Array.from(results);
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
  const format = extractFormat(block, title);
  const availabilityLabel = extractAvailabilityLabel(block);
  const availabilityStatus = extractAvailabilityStatus(availabilityLabel);
  const isbns = extractIsbns(block);
  const identifiers = [
    ...(recordIdFromUrl ? [{ system: 'local' as const, value: recordIdFromUrl }] : []),
    ...isbns.map((value) => ({ system: 'isbn' as const, value })),
  ];

  return {
    id: recordId,
    title,
    authors,
    format,
    detailUrl: detailUrl ?? undefined,
    identifiers: identifiers.length > 0 ? identifiers : undefined,
    availabilityLabel,
    availabilityStatus,
  };
};

const parseAnchorsFallback = (html: string, baseUrl: string) => {
  const anchors = extractAnchors(html).filter((anchor) => anchor.text.length > 1);
  const results: OpacBriefRecord[] = [];

  const seen = new Set<string>();

  for (const [index, anchor] of anchors.entries()) {
    if (!DETAIL_HREF_HINTS.some((hint) => hint.test(anchor.href))) {
      continue;
    }

    if (/tab=showAvailabilityActive|memorizeHitList\.do|hitList\.do/i.test(anchor.href)) {
      continue;
    }

    const detailUrl = resolveUrl(baseUrl, anchor.href);
    if (!detailUrl || !/singleHit\.do/i.test(detailUrl)) {
      continue;
    }

    const title = anchor.text || `Result ${index + 1}`;
    if (!title || /^\?\?\?/.test(title)) {
      continue;
    }

    const recordIdFromUrl = extractRecordIdFromUrl(detailUrl);
    const recordId = recordIdFromUrl ?? `hit-${index + 1}`;
    if (seen.has(recordId)) {
      continue;
    }
    seen.add(recordId);

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
  const rowBlocks = extractRowBlocks(html);
  const blocks = rowBlocks.length > 0 ? rowBlocks : extractBlocks(html);
  const records: OpacBriefRecord[] = [];

  if (blocks.length > 0) {
    blocks.forEach((block, index) => {
      const record = parseBlock(block, baseUrl, index);
      if (record) {
        records.push(record);
      }
    });
  }

  const fallbackRecords = parseAnchorsFallback(html, baseUrl);
  const blockParseLooksNonRecordLike =
    records.length > 0 &&
    records.every(
      (record) =>
        /^Treffer\b/i.test(record.title) ||
        record.id === 'hitList.do' ||
        (record.detailUrl?.includes('/hitList.do') ?? false),
    );

  if (records.length === 0 || (blockParseLooksNonRecordLike && fallbackRecords.length > 0)) {
    return { records: fallbackRecords, total };
  }

  return { records, total };
};
