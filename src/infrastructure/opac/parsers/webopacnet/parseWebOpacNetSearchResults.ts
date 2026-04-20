import type { OpacBriefRecord } from '@/src/domain/models/opac';

const decodeHtml = (value: string): string =>
  value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');

const stripTags = (value: string): string => decodeHtml(value.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

const getAbsoluteUrl = (href: string | undefined, baseUrl: string): string | undefined => {
  if (!href) return undefined;
  if (href.startsWith('http://') || href.startsWith('https://')) return href;
  if (!baseUrl) return href;
  return `${baseUrl}${href.startsWith('/') ? '' : '/'}${href}`;
};

const parseYear = (text: string): number | undefined => {
  const match = text.match(/\b(19\d{2}|20\d{2}|2100)\b/);
  return match ? Number(match[1]) : undefined;
};

const parseAuthor = (rowHtml: string): string | undefined => {
  const stripped = stripTags(rowHtml);
  const match = stripped.match(/(?:^|\b)(?:Autor|Author)\s*:\s*([^\n\r|;]+)/i);
  return match?.[1]?.trim();
};

export const parseWebOpacNetSearchResults = (
  html: string,
  baseUrl: string,
): { total?: number; records: OpacBriefRecord[] } => {
  const records: OpacBriefRecord[] = [];

  const rowRegex = /<tr[^>]*class=["'][^"']*(?:result|treffer|hit)[^"']*["'][^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowRegex.exec(html)) !== null) {
    const rowHtml = rowMatch[1];

    const titleAnchorMatch = rowHtml.match(/<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
    if (!titleAnchorMatch) continue;

    const detailUrl = getAbsoluteUrl(titleAnchorMatch[1], baseUrl);
    const title = stripTags(titleAnchorMatch[2]);
    if (!title) continue;

    const author = parseAuthor(rowHtml);
    const publishedYear = parseYear(rowHtml);

    const recordId = detailUrl ?? `webopac:${title.toLowerCase().replace(/\s+/g, '-')}`;

    records.push({
      id: recordId,
      title,
      authors: author ? [author] : [],
      publishedYear,
      format: 'book',
      detailUrl,
      availabilityStatus: 'unknown',
    });
  }

  const totalMatch = html.match(/(?:Treffer|Results)\s*:?\s*(\d{1,6})/i);
  const total = totalMatch ? Number(totalMatch[1]) : undefined;

  return { total, records };
};
