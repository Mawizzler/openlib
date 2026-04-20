import type { OpacRecord } from '@/src/domain/models/opac';

type BibliothecaParsedSearch = {
  total?: number;
  records: OpacRecord[];
};

const HTML_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': ' ',
};

const decodeHtmlEntities = (value: string) =>
  value
    .replace(/&[a-z]+;|&#\d+;|&#x[0-9a-fA-F]+;/g, (entity) => {
      if (HTML_ENTITIES[entity]) return HTML_ENTITIES[entity];
      if (entity.startsWith('&#x')) {
        const code = Number.parseInt(entity.slice(3, -1), 16);
        return Number.isNaN(code) ? entity : String.fromCharCode(code);
      }
      if (entity.startsWith('&#')) {
        const code = Number.parseInt(entity.slice(2, -1), 10);
        return Number.isNaN(code) ? entity : String.fromCharCode(code);
      }
      return entity;
    })
    .replace(/\s+/g, ' ')
    .trim();

const stripHtml = (value: string) => decodeHtmlEntities(value.replace(/<[^>]*>/g, ' '));

const resolveUrl = (baseUrl: string, href: string) => {
  try {
    return new URL(href, `${baseUrl.replace(/\/+$/, '')}/`).toString();
  } catch {
    return href;
  }
};

const extractTotal = (html: string): number | undefined => {
  const patterns = [
    /(?:ergab|found|results?)\D{0,20}(\d{1,6})/i,
    /\b(\d{1,6})\b\s*(?:treffer|results?)\b/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (!match) continue;
    const value = Number.parseInt(match[1], 10);
    if (!Number.isNaN(value)) return value;
  }

  return undefined;
};

const extractTitleAndHref = (block: string): { title?: string; href?: string } => {
  const anchorMatch = block.match(/<a[^>]+href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
  if (!anchorMatch) return {};
  return {
    href: anchorMatch[1],
    title: stripHtml(anchorMatch[2]) || undefined,
  };
};

export const parseBibliothecaSearchResults = (html: string, baseUrl: string): BibliothecaParsedSearch => {
  if (!html || html.trim().length === 0) {
    return { records: [] };
  }

  const records: OpacRecord[] = [];
  const seenIds = new Set<string>();
  const blockRegex = /<(?:tr|div|li)[^>]*(?:class\s*=\s*["'][^"']*(?:result|hit|titel|title|record|row)[^"']*["'])[^>]*>([\s\S]*?)<\/(?:tr|div|li)>/gi;

  let blockMatch: RegExpExecArray | null = null;
  while ((blockMatch = blockRegex.exec(html)) !== null) {
    const block = blockMatch[0];
    const { title, href } = extractTitleAndHref(block);
    if (!title) continue;

    const detailUrl = href ? resolveUrl(baseUrl, href) : undefined;
    const idMatch = detailUrl?.match(/[?&](?:id|mednr|record|titleid)=([^&#]+)/i);
    const fallbackId = detailUrl ?? `${title}-${records.length + 1}`;
    const id = decodeURIComponent(idMatch?.[1] ?? fallbackId).trim();
    if (!id || seenIds.has(id)) continue;

    seenIds.add(id);
    records.push({
      id,
      title,
      authors: [],
      publishedYear: undefined,
      format: undefined,
      coverUrl: undefined,
      detailUrl,
      availabilityLabel: undefined,
    });
  }

  return {
    total: extractTotal(html),
    records,
  };
};
