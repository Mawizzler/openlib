import type {
  LibrarySystemAdapter,
  LibraryAccountLoginInput,
  LibraryAccountLoginResult,
  LibraryAccountSnapshotResult,
  LibraryAccountSession,
  LibraryAccountIdentity,
  LibrarySystemSearchInput,
} from '@/src/application/ports/LibrarySystemAdapter';
import type {
  OpacAvailability,
  OpacRecord,
  OpacSearchResult,
} from '@/src/domain/models/opac';
import type { OpacappNormalizedProvider } from '@/src/domain/models/opacapp';
import { parseSisisSearchResults } from '@/src/infrastructure/opac/parsers/sisis/parseSisisSearchResults';

type SessionState = {
  cookie?: string;
};

type SisisAuthSessionPayload = {
  cookie: string;
  accountUrl: string;
  username: string;
};

const DEFAULT_PAGE_SIZE = 20;
const DEFAULT_TIMEOUT_MS = 8000;
const META_TITLE_KEYS = ['citation_title', 'dc.title', 'dcterms.title', 'og:title', 'twitter:title'];
const META_AUTHOR_KEYS = ['citation_author', 'dc.creator', 'dcterms.creator', 'author'];
const META_DESCRIPTION_KEYS = ['description', 'dc.description', 'dcterms.description', 'og:description'];
const META_PUBLISHER_KEYS = ['citation_publisher', 'dc.publisher', 'dcterms.publisher'];
const META_LANGUAGE_KEYS = ['dc.language', 'dcterms.language', 'language'];
const META_DATE_KEYS = ['citation_publication_date', 'dc.date', 'dcterms.issued', 'dcterms.date'];
const META_COVER_KEYS = ['og:image', 'twitter:image', 'citation_cover_url'];

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

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const extractMetaValues = (html: string, key: string): string[] => {
  const escaped = escapeRegex(key);
  const values: string[] = [];
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:name|property)\\s*=\\s*["']${escaped}["'][^>]*content\\s*=\\s*["']([^"']+)["'][^>]*>`,
      'gi',
    ),
    new RegExp(
      `<meta[^>]+content\\s*=\\s*["']([^"']+)["'][^>]*(?:name|property)\\s*=\\s*["']${escaped}["'][^>]*>`,
      'gi',
    ),
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null = null;
    while ((match = pattern.exec(html)) !== null) {
      values.push(stripHtml(match[1]));
    }
  }

  return values.filter(Boolean);
};

const extractFirstMeta = (html: string, keys: string[]) => {
  for (const key of keys) {
    const values = extractMetaValues(html, key);
    if (values.length > 0) return values[0];
  }
  return undefined;
};

const extractAllMeta = (html: string, keys: string[]) => {
  const values: string[] = [];
  for (const key of keys) {
    values.push(...extractMetaValues(html, key));
  }
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
};

const extractTitleTag = (html: string) => {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!match) return undefined;
  const title = stripHtml(match[1]);
  return title || undefined;
};

const extractHeadingTitle = (html: string) => {
  const h2Match = html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
  if (h2Match) {
    const title = stripHtml(h2Match[1]);
    if (title) return title;
  }
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (!h1Match) return undefined;
  const title = stripHtml(h1Match[1]);
  if (!title || /^lokaler\s+bestand/i.test(title)) return undefined;
  return title;
};

const extractYear = (value?: string) => {
  if (!value) return undefined;
  const match = value.match(/\b(1[5-9]\d{2}|20\d{2})\b/);
  if (!match) return undefined;
  const year = Number.parseInt(match[1], 10);
  return Number.isNaN(year) ? undefined : year;
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

const extractIsbns = (html: string) => {
  const results = new Set<string>();
  const urlRegex = /isbns?=([^&"'\\s>]+)/gi;
  let urlMatch: RegExpExecArray | null = null;

  while ((urlMatch = urlRegex.exec(html)) !== null) {
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

  const text = stripHtml(html);
  const textRegex = /ISBN[^0-9Xx]{0,6}([0-9Xx][0-9Xx\\-\\s]{8,16}[0-9Xx])/gi;
  let textMatch: RegExpExecArray | null = null;
  while ((textMatch = textRegex.exec(text)) !== null) {
    const normalized = normalizeIsbn(textMatch[1]);
    if (normalized) results.add(normalized);
  }

  return Array.from(results);
};

const extractAvailabilityLabel = (html: string) => {
  const linkMatch = html.match(/availability\.do[^>]*>([\s\S]*?)<\/a>/i);
  if (linkMatch) {
    const cleanedLink = linkMatch[1].replace(/<span[^>]*>[\s\S]*?<\/span>/gi, '');
    const label = stripHtml(cleanedLink).replace(/\?{3}[^?]+\?{3}/g, '').trim();
    if (label) return label;
  }

  const spanMatch = html.match(
    /<span[^>]*class=["'][^"']*(?:textgruen|textrot|textgelb|textorange|textblue)[^"']*["'][^>]*>([\s\S]*?)<\/span>/i,
  );
  if (spanMatch) {
    const label = stripHtml(spanMatch[1]).replace(/\?{3}[^?]+\?{3}/g, '').trim();
    if (label) return label;
  }

  const statusMatch = html.match(
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

const resolveUrl = (baseUrl: string, href: string) => {
  try {
    return new URL(href, `${baseUrl.replace(/\/+$/, '')}/`).toString();
  } catch {
    return href;
  }
};

export class SisisAdapter implements LibrarySystemAdapter {
  readonly system = 'sisis';
  private provider: OpacappNormalizedProvider;
  private lastSession?: { cookie?: string; baseUrl: string; createdAt: number };

  constructor(provider: OpacappNormalizedProvider) {
    this.provider = provider;
  }

  async search(input: LibrarySystemSearchInput): Promise<OpacSearchResult> {
    const page = input.page ?? 1;
    const pageSize = DEFAULT_PAGE_SIZE;
    const query = input.query.trim();

    if (!query || !this.provider.baseUrl) {
      return {
        total: 0,
        page,
        pageSize,
        records: [],
      };
    }

    try {
      const baseUrl = this.normalizeBaseUrl(this.provider.baseUrl);
      const session: SessionState = {};

      await this.fetchHtml(`${baseUrl}/start.do`, session);

      const searchUrl = this.buildSearchUrl(baseUrl, query);
      const searchHtml = await this.fetchHtml(searchUrl, session);

      const resultsHtml = await this.resolveResultsPage({
        baseUrl,
        page,
        pageSize,
        session,
        html: searchHtml,
      });

      const parsed = parseSisisSearchResults(resultsHtml, baseUrl);
      this.lastSession = { cookie: session.cookie, baseUrl, createdAt: Date.now() };

      return {
        total: parsed.total ?? parsed.records.length,
        page,
        pageSize,
        records: parsed.records,
      };
    } catch (error) {
      console.warn('[SisisAdapter] search failed', error);
      return {
        total: 0,
        page,
        pageSize,
        records: [],
      };
    }
  }

  async details(input: { recordId: string; detailUrl?: string }): Promise<OpacRecord | null> {
    const detailUrl = this.resolveDetailUrl(input);
    if (!detailUrl) {
      return null;
    }

    const session: SessionState = {};
    try {
      const baseUrl = this.provider.baseUrl ? this.normalizeBaseUrl(this.provider.baseUrl) : undefined;
      const now = Date.now();
      if (
        baseUrl &&
        this.lastSession?.baseUrl === baseUrl &&
        this.lastSession.cookie &&
        now - this.lastSession.createdAt < 5 * 60 * 1000
      ) {
        session.cookie = this.lastSession.cookie;
      } else if (baseUrl) {
        await this.fetchHtml(`${baseUrl}/start.do`, session);
      }

      let html = await this.fetchHtml(detailUrl, session);
      if (baseUrl && this.isSessionInvalid(html)) {
        const retrySession: SessionState = {};
        await this.fetchHtml(`${baseUrl}/start.do`, retrySession);
        html = await this.fetchHtml(detailUrl, retrySession);
      }
      return this.parseDetailHtml(html, detailUrl, input.recordId);
    } catch (error) {
      console.warn('[SisisAdapter] details failed', error);
      throw error;
    }
  }

  async availability(input: { recordId: string }): Promise<OpacAvailability> {
    return {
      recordId: input.recordId,
      availableCount: 0,
      totalCount: 0,
      holdsCount: 0,
    };
  }

  async accountLogin(input: LibraryAccountLoginInput): Promise<LibraryAccountLoginResult> {
    if (!this.isAccountLoginSupported()) {
      return {
        status: 'not_supported',
        message: 'Library account login is not supported for this provider yet.',
      };
    }

    if (!input.username.trim() || !input.password.trim()) {
      return {
        status: 'invalid_credentials',
        message: 'Please enter both username and password.',
      };
    }

    if (!this.provider.baseUrl) {
      return {
        status: 'error',
        message: 'Missing SISIS base URL for provider.',
      };
    }

    try {
      const authSession = await this.loginSisisSession(input);
      return {
        status: 'success',
        identity: this.buildIdentity(input.username),
        session: this.buildSession(authSession),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'SISIS login failed.';
      return {
        status: message.toLowerCase().includes('credential') ? 'invalid_credentials' : 'error',
        message,
      };
    }
  }

  async fetchAccountSnapshot(input: {
    identity: LibraryAccountIdentity;
    session: LibraryAccountSession;
  }): Promise<LibraryAccountSnapshotResult> {
    if (!this.isAccountLoginSupported()) {
      return {
        status: 'not_supported',
        message: 'Account snapshots are not supported for this provider yet.',
      };
    }

    if (!this.provider.baseUrl) {
      return {
        status: 'error',
        message: 'Missing SISIS base URL for provider.',
      };
    }

    const authSession = this.parseSessionToken(input.session.opaqueToken);
    if (!authSession) {
      return {
        status: 'error',
        message: 'Invalid or missing SISIS session token.',
      };
    }

    const session: SessionState = { cookie: authSession.cookie };
    try {
      await this.fetchHtml(authSession.accountUrl, session);
      return {
        status: 'success',
        snapshot: {
          loans: [],
          reservations: [],
        },
      };
    } catch (error) {
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to fetch account snapshot.',
      };
    }
  }

  private async loginSisisSession(input: LibraryAccountLoginInput): Promise<SisisAuthSessionPayload> {
    const baseUrl = this.normalizeBaseUrl(this.provider.baseUrl ?? '');
    const session: SessionState = {};
    const startHtml = await this.fetchHtml(`${baseUrl}/start.do`, session);
    const loginUrl = this.extractAccountLoginUrl(startHtml, baseUrl) ?? `${baseUrl}/userAccount.do`;

    const html = await this.fetchHtml(
      `${loginUrl}${loginUrl.includes('?') ? '&' : '?'}methodToCall=showLogin`,
      session,
    );

    if (!session.cookie || this.containsLoginError(html)) {
      throw new Error('Invalid credentials for SISIS account login.');
    }

    return {
      cookie: session.cookie,
      accountUrl: loginUrl,
      username: input.username,
    };
  }

  private extractAccountLoginUrl(html: string, baseUrl: string): string | null {
    const match = html.match(/href\s*=\s*["']([^"']*userAccount\.do[^"']*)["']/i);
    if (!match) return null;
    try {
      return new URL(match[1].replace(/&amp;/g, '&'), `${baseUrl}/`).toString();
    } catch {
      return null;
    }
  }

  private containsLoginError(html: string): boolean {
    return /fehl(er|geschlagen)|invalid|ungültig|passwort|kennwort/i.test(html);
  }

  private parseSessionToken(token?: string): SisisAuthSessionPayload | null {
    if (!token) return null;
    if (!token.startsWith('sisis:')) return null;
    try {
      const payload = JSON.parse(Buffer.from(token.slice(6), 'base64').toString('utf8')) as SisisAuthSessionPayload;
      if (!payload.cookie || !payload.accountUrl) return null;
      return payload;
    } catch {
      return null;
    }
  }

  private normalizeBaseUrl(baseUrl: string): string {
    const trimmed = baseUrl.replace(/\/+$/, '');
    try {
      const url = new URL(trimmed);
      if (
        String(this.provider.id) === '8714' &&
        url.hostname.toLowerCase() === 'webopac.stadtbibliothek-leipzig.de'
      ) {
        // Leipzig's legacy webopac hostname presents a mismatched TLS certificate;
        // bibliothekskatalog.leipzig.de is the canonical SISIS endpoint exposed by the library.
        url.hostname = 'bibliothekskatalog.leipzig.de';
        return url.toString().replace(/\/+$/, '');
      }
    } catch {
      // Keep original URL if parsing fails.
    }
    return trimmed;
  }

  private isSessionInvalid(html: string): boolean {
    return /sitzung[^<]*g[üu]ltig|session[^<]*invalid/i.test(html);
  }

  private resolveDetailUrl(input: { recordId: string; detailUrl?: string }): string | null {
    if (input.detailUrl) return input.detailUrl;
    if (input.recordId.startsWith('http://') || input.recordId.startsWith('https://')) {
      return input.recordId;
    }
    return null;
  }

  private parseDetailHtml(html: string, detailUrl: string, recordId: string): OpacRecord | null {
    const title =
      extractFirstMeta(html, META_TITLE_KEYS) ??
      extractHeadingTitle(html) ??
      extractTitleTag(html);
    const authors = extractAllMeta(html, META_AUTHOR_KEYS);
    const description = extractFirstMeta(html, META_DESCRIPTION_KEYS);
    const publisher = extractFirstMeta(html, META_PUBLISHER_KEYS);
    const language = extractFirstMeta(html, META_LANGUAGE_KEYS);
    const publishedYear = extractYear(extractFirstMeta(html, META_DATE_KEYS));
    const coverCandidate = extractFirstMeta(html, META_COVER_KEYS);
    const coverUrl = coverCandidate ? resolveUrl(detailUrl, coverCandidate) : undefined;
    const availabilityLabel = extractAvailabilityLabel(html);
    const availabilityStatus = extractAvailabilityStatus(availabilityLabel);
    const isbns = extractIsbns(html);

    if (!title) {
      return null;
    }

    return {
      id: recordId,
      title,
      authors: authors.length ? authors : [],
      detailUrl,
      description,
      publisher,
      language,
      publishedYear,
      coverUrl,
      availabilityLabel,
      availabilityStatus,
      identifiers: isbns.length > 0 ? isbns.map((value) => ({ system: 'isbn', value })) : undefined,
    };
  }

  private buildSearchUrl(baseUrl: string, query: string): string {
    if (String(this.provider.id) === '8714') {
      const url = new URL(`${baseUrl}/start.do`);
      // Leipzig SISIS responds on ConQuery start endpoint (not generic search.do submit flow)
      url.searchParams.set('sourceid', 'ConQuery');
      url.searchParams.set('Login', 'stabi00');
      url.searchParams.set('Query', `-1 = "${query}"`);
      return url.toString();
    }

    const url = new URL(`${baseUrl}/search.do`);
    url.searchParams.set('methodToCall', 'submit');
    url.searchParams.set('searchCategories[0]', 'all');
    url.searchParams.set('searchString[0]', query);
    return url.toString();
  }

  private async resolveResultsPage(input: {
    baseUrl: string;
    page: number;
    pageSize: number;
    session: SessionState;
    html: string;
  }): Promise<string> {
    const hitListUrl = this.extractHitListUrl(input.html, input.baseUrl);
    if (!hitListUrl) {
      return input.html;
    }

    if (input.page <= 1) {
      const hitListHtml = await this.fetchHtml(hitListUrl, input.session);
      return hitListHtml || input.html;
    }

    try {
      const url = new URL(hitListUrl);
      const curPos = (input.page - 1) * input.pageSize + 1;
      url.searchParams.set('methodToCall', url.searchParams.get('methodToCall') ?? 'pos');
      url.searchParams.set('curPos', String(curPos));
      const pageHtml = await this.fetchHtml(url.toString(), input.session);
      return pageHtml || input.html;
    } catch {
      return input.html;
    }
  }

  private extractHitListUrl(html: string, baseUrl: string): string | null {
    const match = html.match(/href\s*=\s*["']([^"']*hitList\.do[^"']*)["']/i);
    if (!match) return null;
    try {
      const decodedHref = match[1].replace(/&amp;/g, '&');
      return new URL(decodedHref, `${baseUrl}/`).toString();
    } catch {
      return null;
    }
  }

  private async fetchHtml(url: string, session: SessionState): Promise<string> {
    const controller = new AbortController();
    const handle = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'text/html,application/xhtml+xml',
          'User-Agent': 'openlib-sisis-adapter',
          ...(session.cookie ? { Cookie: session.cookie } : {}),
        },
        redirect: 'follow',
        signal: controller.signal,
      });

      this.captureCookies(response, session);
      return await response.text();
    } finally {
      clearTimeout(handle);
    }
  }

  private captureCookies(response: Response, session: SessionState) {
    try {
      const setCookie = response.headers.get('set-cookie');
      if (!setCookie) return;
      const cookies = setCookie
        .split(',')
        .map((cookiePart) => cookiePart.split(';')[0]?.trim())
        .filter(Boolean);
      if (cookies.length > 0) {
        session.cookie = cookies.join('; ');
      }
    } catch {
      // Ignore cookie parsing errors; SISIS will often still respond without session persistence.
    }
  }

  private isAccountLoginSupported(): boolean {
    return Boolean(this.provider.accountSupported) || this.provider.authHint === 'opac';
  }

  private buildIdentity(username: string): LibraryAccountIdentity {
    return {
      providerId: this.provider.id,
      providerTitle: this.provider.title,
      system: this.system,
      authHint: this.provider.authHint,
      username,
    };
  }

  private buildSession(payload: SisisAuthSessionPayload): LibraryAccountSession {
    return {
      id: `${this.system}-${this.provider.id}-${Date.now()}`,
      createdAt: new Date().toISOString(),
      opaqueToken: `sisis:${Buffer.from(JSON.stringify(payload), 'utf8').toString('base64')}`,
    };
  }
}
