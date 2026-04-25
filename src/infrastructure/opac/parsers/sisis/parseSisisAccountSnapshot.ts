import type { AccountLoan, AccountReservation } from '@/src/domain/models/account';

type SisisAccountLinks = {
  loansUrl?: string;
  reservationsUrl?: string;
};

const HTML_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': ' ',
};

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
    return new URL(href.replace(/&amp;/g, '&'), `${baseUrl.replace(/\/+$/, '')}/`).toString();
  } catch {
    return undefined;
  }
};

const extractTableRows = (html: string) => {
  const rows: string[] = [];
  const rowRegex = /<tr\b[^>]*>[\s\S]*?<\/tr>/gi;
  let match: RegExpExecArray | null = null;
  while ((match = rowRegex.exec(html)) !== null) {
    rows.push(match[0]);
  }
  return rows;
};

const extractCells = (row: string) => {
  const cells: string[] = [];
  const cellRegex = /<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi;
  let match: RegExpExecArray | null = null;
  while ((match = cellRegex.exec(row)) !== null) {
    const cell = stripHtml(match[1]);
    if (cell) {
      cells.push(cell);
    }
  }
  return cells;
};

const extractTitle = (row: string, cells: string[]) => {
  const linkMatch = row.match(/<a\b[^>]*>([\s\S]*?)<\/a>/i);
  const linkedTitle = linkMatch ? stripHtml(linkMatch[1]) : '';
  if (linkedTitle && !/verl[aä]nger|details?|konto|vormerk|reserv/i.test(linkedTitle)) {
    return linkedTitle;
  }
  return cells.find((cell) => !looksLikeDate(cell) && !/verl[aä]nger|status|f[aä]llig|abhol/i.test(cell)) ?? '';
};

const looksLikeDate = (value: string) => /\b\d{1,2}[./-]\d{1,2}[./-](?:\d{2}|\d{4})\b/.test(value);

const normalizeDate = (value: string) => {
  const match = value.match(/\b(\d{1,2})[./-](\d{1,2})[./-](\d{2}|\d{4})\b/);
  if (!match) return value;

  const day = match[1].padStart(2, '0');
  const month = match[2].padStart(2, '0');
  const year = match[3].length === 2 ? `20${match[3]}` : match[3];
  return `${year}-${month}-${day}`;
};

const makeId = (prefix: string, title: string, date: string, index: number) =>
  `${prefix}-${index + 1}-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'item'}-${date}`;

const rowMentionsLoan = (row: string) =>
  /ausleih|entliehen|f[aä]llig|r[uü]ckgabe|verl[aä]nger/i.test(stripHtml(row));

const rowMentionsReservation = (row: string) =>
  /vormerk|reserv|bestell|abhol|bereit|benachrichtig/i.test(stripHtml(row));

export const extractSisisAccountLinks = (html: string, baseUrl: string): SisisAccountLinks => {
  const links: SisisAccountLinks = {};
  const anchorRegex = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null = null;

  while ((match = anchorRegex.exec(html)) !== null) {
    const href = match[1];
    const text = stripHtml(match[2]);
    const candidate = `${href} ${text}`;
    if (!links.loansUrl && /show(?:Loans|Borrowed|Account)|ausleih|entliehen|konto/i.test(candidate)) {
      links.loansUrl = resolveUrl(baseUrl, href);
    }
    if (!links.reservationsUrl && /show(?:Reservations|Requests|Holds)|vormerk|reserv|bestell/i.test(candidate)) {
      links.reservationsUrl = resolveUrl(baseUrl, href);
    }
  }

  return links;
};

export const parseSisisAccountLoans = (html: string): AccountLoan[] =>
  extractTableRows(html)
    .filter((row) => rowMentionsLoan(row))
    .map((row) => {
      const cells = extractCells(row);
      const title = extractTitle(row, cells);
      const dueDate = normalizeDate(cells.find(looksLikeDate) ?? '');
      return { row, title, dueDate };
    })
    .filter((entry) => entry.title && entry.dueDate)
    .map((entry, index) => ({
      id: makeId('loan', entry.title, entry.dueDate, index),
      title: entry.title,
      dueDate: entry.dueDate,
      status: /[uü]berf[aä]llig|mahn/i.test(stripHtml(entry.row)) ? 'overdue' : 'checked_out',
    }));

export const parseSisisAccountReservations = (html: string): AccountReservation[] =>
  extractTableRows(html)
    .filter((row) => rowMentionsReservation(row))
    .map((row) => {
      const cells = extractCells(row);
      const title = extractTitle(row, cells);
      const pickupByDate = normalizeDate(cells.find(looksLikeDate) ?? '');
      const pickupLocation = cells.find((cell) => /bibliothek|filiale|zweigstelle|standort/i.test(cell));
      return { row, title, pickupByDate, pickupLocation };
    })
    .filter((entry) => entry.title && entry.pickupByDate)
    .map((entry, index) => ({
      id: makeId('reservation', entry.title, entry.pickupByDate, index),
      title: entry.title,
      pickupByDate: entry.pickupByDate,
      pickupLocation: entry.pickupLocation,
      status: /bereit|abhol/i.test(stripHtml(entry.row)) ? 'ready' : 'in_transit',
    }));
