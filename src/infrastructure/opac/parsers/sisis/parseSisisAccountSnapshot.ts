import type { AccountLoan, AccountReservation } from '@/src/domain/models/account';

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
    const decodedHref = href.replace(/&amp;/g, '&');
    return new URL(decodedHref, `${baseUrl.replace(/\/+$/, '')}/`).toString();
  } catch {
    return null;
  }
};

const extractRows = (html: string) => {
  const rows: string[] = [];
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let match: RegExpExecArray | null = null;
  while ((match = rowRegex.exec(html)) !== null) {
    rows.push(match[0]);
  }
  return rows;
};

const extractCells = (row: string) => {
  const cells: string[] = [];
  const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
  let match: RegExpExecArray | null = null;
  while ((match = cellRegex.exec(row)) !== null) {
    const cellText = stripHtml(match[1]);
    if (cellText) {
      cells.push(cellText);
    }
  }
  return cells;
};

const extractDate = (text: string) => {
  const match = text.match(/\b(\d{1,2}\.\d{1,2}\.\d{2,4}|\d{4}-\d{2}-\d{2})\b/);
  return match ? match[1] : null;
};

const isHeaderRow = (cells: string[]) => {
  const headerText = cells.join(' ').toLowerCase();
  return (
    /titel|title|medium|medien|verfasser|author|ausleihe|vormerk|reservation|reservierung/.test(
      headerText,
    ) && !/\d{1,2}\.\d{1,2}\.\d{2,4}|\d{4}-\d{2}-\d{2}/.test(headerText)
  );
};

const pickTitle = (cells: string[]) => {
  const candidates = cells.filter(
    (cell) =>
      cell.length > 1 &&
      !/\b\d{1,2}\.\d{1,2}\.\d{2,4}\b/.test(cell) &&
      !/\b\d{4}-\d{2}-\d{2}\b/.test(cell),
  );
  if (candidates.length === 0) return null;
  return candidates.sort((a, b) => b.length - a.length)[0];
};

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);

const buildEntryId = (prefix: string, index: number, title: string, date: string) => {
  const slug = slugify(`${title}-${date}`);
  return slug ? `${prefix}-${index + 1}-${slug}` : `${prefix}-${index + 1}`;
};

export const extractSisisAccountLinks = (
  html: string,
  baseUrl: string,
): { loansUrl?: string; reservationsUrl?: string } => {
  const links = { loansUrl: undefined as string | undefined, reservationsUrl: undefined as string | undefined };
  const regex = /<a[^>]*href\s*=\s*["']([^"']*userAccount\.do[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null = null;
  while ((match = regex.exec(html)) !== null) {
    const href = match[1];
    const text = stripHtml(match[2]).toLowerCase();
    const resolved = resolveUrl(baseUrl, href);
    if (!resolved) continue;
    if (!links.loansUrl && /(ausleih|entleih|loan|borrow)/.test(text)) {
      links.loansUrl = resolved;
    }
    if (
      !links.reservationsUrl &&
      /(vormerk|reserv|hold|bestell|bereitstell|abhol|request)/.test(text)
    ) {
      links.reservationsUrl = resolved;
    }
  }
  return links;
};

export const parseSisisAccountLoans = (html: string): AccountLoan[] => {
  const rows = extractRows(html);
  const loans: AccountLoan[] = [];

  rows.forEach((row, index) => {
    const cells = extractCells(row);
    if (cells.length === 0 || isHeaderRow(cells)) return;
    const rowText = cells.join(' ');
    const dueDate = extractDate(rowText);
    if (!dueDate) return;
    const title = pickTitle(cells);
    if (!title) return;

    const normalized = rowText.toLowerCase();
    let status: AccountLoan['status'] = 'checked_out';
    if (/überfällig|ueberfaellig|overdue|mahn/.test(normalized)) {
      status = 'overdue';
    } else if (/zurückgegeben|zurueckgegeben|returned/.test(normalized)) {
      status = 'returned';
    }

    loans.push({
      id: buildEntryId('loan', index, title, dueDate),
      title,
      dueDate,
      status,
    });
  });

  return loans;
};

const extractLocation = (cells: string[]) => {
  const match = cells.find((cell) =>
    /(abhol|ausgabe|theke|zweigstelle|filiale|bibliothek|standort|location)/i.test(cell),
  );
  return match ?? undefined;
};

export const parseSisisAccountReservations = (html: string): AccountReservation[] => {
  const rows = extractRows(html);
  const reservations: AccountReservation[] = [];

  rows.forEach((row, index) => {
    const cells = extractCells(row);
    if (cells.length === 0 || isHeaderRow(cells)) return;
    const rowText = cells.join(' ');
    const pickupByDate = extractDate(rowText);
    if (!pickupByDate) return;
    const title = pickTitle(cells);
    if (!title) return;

    const normalized = rowText.toLowerCase();
    let status: AccountReservation['status'] = 'in_transit';
    if (/bereit|abholbereit|ready|abholen/.test(normalized)) {
      status = 'ready';
    } else if (/unterwegs|in\s+transit|transport/.test(normalized)) {
      status = 'in_transit';
    } else if (/abgelaufen|expired/.test(normalized)) {
      status = 'expired';
    } else if (/abgeholt|collected/.test(normalized)) {
      status = 'collected';
    }

    reservations.push({
      id: buildEntryId('reservation', index, title, pickupByDate),
      title,
      pickupByDate,
      pickupLocation: extractLocation(cells),
      status,
    });
  });

  return reservations;
};
