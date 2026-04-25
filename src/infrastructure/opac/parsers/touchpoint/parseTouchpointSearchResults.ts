import type { OpacBriefRecord } from '@/src/domain/models/opac';

export type ParsedTouchpointSearchResults = {
  total?: number;
  records: OpacBriefRecord[];
};

const decodeHtml = (value: string) =>
  value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .trim();

const stripTags = (value: string) => decodeHtml(value.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();

const toAbsoluteUrl = (href: string, baseUrl: string) => {
  if (!href) return undefined;
  if (/^https?:\/\//i.test(href)) return href;
  if (!baseUrl) return href;
  if (href.startsWith('/')) return `${baseUrl}${href}`;
  return `${baseUrl}/${href}`;
};

export const parseTouchpointSearchResults = (
  html: string,
  baseUrl = '',
): ParsedTouchpointSearchResults => {
  if (!html || typeof html !== 'string') return { records: [] };

  const records: OpacBriefRecord[] = [];
  const itemRegex =
    /<(li|div|article)[^>]*class=["'][^"']*(?:resultListItem|searchResultItem|hitItem|result-item)[^"']*["'][^>]*>([\s\S]*?)<\/\1>/gi;
  let itemMatch: RegExpExecArray | null;
  let index = 0;

  while ((itemMatch = itemRegex.exec(html)) !== null) {
    const block = itemMatch[2] ?? '';
    const linkMatch =
      block.match(/<a[^>]*class=["'][^"']*(?:title|hitTitle|recordTitle|result-title)[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i) ??
      block.match(/<a[^>]*href=["']([^"']+)["'][^>]*class=["'][^"']*(?:title|hitTitle|recordTitle|result-title)[^"']*["'][^>]*>([\s\S]*?)<\/a>/i) ??
      block.match(/<a[^>]*href=["']([^"']*(?:showHit|record|detail)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/i);

    const detailHref = decodeHtml(linkMatch?.[1]?.trim() ?? '');
    const title = stripTags(linkMatch?.[2] ?? '');
    if (!title) continue;

    const idFromHref = detailHref.match(/id=([^&"']+)/i)?.[1];
    const id = idFromHref ? decodeURIComponent(idFromHref) : `touchpoint-${index + 1}`;

    const authorMatch =
      block.match(/<(?:span|div|p)[^>]*class=["'][^"']*(?:author|person|creator|verfasser)[^"']*["'][^>]*>([\s\S]*?)<\/(?:span|div|p)>/i) ??
      block.match(/(?:Author|Verfasser)\s*[:\-]?\s*<\/?[^>]*>\s*([^<]{2,200})/i);
    const authorText = stripTags(authorMatch?.[1] ?? '');
    const authors = authorText
      ? authorText
          .split(/;|,\s*(?=[A-ZÄÖÜ])/)
          .map((entry) => entry.trim())
          .filter(Boolean)
      : [];

    const yearMatch = block.match(/\b(19|20)\d{2}\b/);
    const publishedYear = yearMatch ? Number.parseInt(yearMatch[0], 10) : undefined;

    records.push({
      id,
      title,
      authors,
      detailUrl: toAbsoluteUrl(detailHref, baseUrl),
      publishedYear,
    });

    index += 1;
  }

  const totalMatch =
    html.match(/class=["'][^"']*(?:resultCount|resultsCount|hitCount)[^"']*["'][^>]*>[^<]*?(\d{1,5})/i) ??
    html.match(/(\d{1,5})\s*(?:Treffer|results)/i) ??
    html.match(/(?:Treffer|results)\D{0,20}(\d{1,5})/i);
  const total = totalMatch ? Number.parseInt(totalMatch[1], 10) : undefined;

  return { total, records };
};
