import type { OpacBriefRecord } from '@/src/domain/models/opac';

export type ParsedOpenMediensucheResults = {
  records: OpacBriefRecord[];
};

const decodeHtml = (value: string): string =>
  value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();

const toAbsoluteUrl = (href: string, baseUrl: string): string => {
  try {
    return new URL(href, `${baseUrl}/`).toString();
  } catch {
    return href;
  }
};

export const parseOpenMediensucheResults = (
  html: string,
  baseUrl: string,
): ParsedOpenMediensucheResults => {
  if (!html?.trim()) return { records: [] };

  const records: OpacBriefRecord[] = [];
  const seenIds = new Set<string>();
  const anchorPattern = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null = null;

  while ((match = anchorPattern.exec(html)) !== null) {
    const href = (match[1] ?? '').trim();
    if (!href) continue;

    const innerHtml = match[2] ?? '';
    const title = decodeHtml(innerHtml.replace(/<[^>]+>/g, ''));
    if (!title) continue;

    if (!/detail|titel|medien|record|item|book|anzeige/i.test(href)) {
      continue;
    }

    const detailUrl = toAbsoluteUrl(href, baseUrl);
    const id = detailUrl || `medien-${records.length}`;
    if (seenIds.has(id)) continue;
    seenIds.add(id);

    records.push({
      id,
      title,
      authors: [],
      detailUrl,
    });
  }

  return { records };
};
