import type { OpacBriefRecord } from '@/src/domain/models/opac';

export type ParsedKohaSearchResults = {
  total?: number;
  records: OpacBriefRecord[];
};

const stripTags = (value: string) => value.replace(/<[^>]*>/g, ' ');

const decodeHtmlEntities = (value: string) =>
  value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');

const cleanText = (value?: string) => {
  if (!value) return '';
  return decodeHtmlEntities(stripTags(value)).replace(/\s+/g, ' ').trim();
};

const resolveUrl = (baseUrl: string, href: string) => {
  try {
    return new URL(href, `${baseUrl}/`).toString();
  } catch {
    return href;
  }
};

const extractTotal = (html: string): number | undefined => {
  const patterns = [
    /class=["'][^"']*results[^"']*["'][^>]*>[^<]*([\d.,]+)\s+results?/i,
    /([\d.,]+)\s+results?\s+found/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (!match) continue;
    const normalized = match[1].replace(/[.,](?=\d{3}\b)/g, '');
    const total = Number.parseInt(normalized, 10);
    if (!Number.isNaN(total)) return total;
  }

  return undefined;
};

const parseRecord = (block: string, index: number, baseUrl: string): OpacBriefRecord | null => {
  const titleMatch = block.match(
    /<a[^>]+(?:class=["'][^"']*(?:title|resultsummary)[^"']*["'][^>]*)?href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i,
  );

  if (!titleMatch) return null;

  const detailUrl = resolveUrl(baseUrl, titleMatch[1]);
  const title = cleanText(titleMatch[2]);
  if (!title) return null;

  const idFromBiblio = detailUrl.match(/[?&]biblionumber=(\d+)/i)?.[1];
  const id = idFromBiblio ?? `koha-${index}`;

  const authorMatch = block.match(/class=["'][^"']*author[^"']*["'][^>]*>([\s\S]*?)<\/span>/i);
  const author = cleanText(authorMatch?.[1]);

  const yearMatch = block.match(/\b(1[5-9]\d{2}|20\d{2})\b/);
  const publishedYear = yearMatch ? Number.parseInt(yearMatch[1], 10) : undefined;

  return {
    id,
    title,
    authors: author ? [author] : [],
    detailUrl,
    publishedYear,
  };
};

export const parseKohaSearchResults = (html: string, baseUrl: string): ParsedKohaSearchResults => {
  const blocks = html.match(/<li[^>]*class=["'][^"']*bibliocol[^"']*["'][\s\S]*?<\/li>/gi) ?? [];

  const records: OpacBriefRecord[] = blocks
    .map((block, index) => parseRecord(block, index, baseUrl))
    .filter((record): record is OpacBriefRecord => Boolean(record));

  return {
    total: extractTotal(html),
    records,
  };
};
