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

const extractYear = (value?: string) => {
  if (!value) return undefined;
  const match = value.match(/\b(1[5-9]\d{2}|20\d{2})\b/);
  if (!match) return undefined;
  const year = Number.parseInt(match[1], 10);
  return Number.isNaN(year) ? undefined : year;
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
      if (this.provider.baseUrl) {
        const baseUrl = this.normalizeBaseUrl(this.provider.baseUrl);
        await this.fetchHtml(`${baseUrl}/start.do`, session);
      }
      const html = await this.fetchHtml(detailUrl, session);
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

    return {
      status: 'success',
      identity: this.buildIdentity(input.username),
      session: this.buildSession(),
      message: 'Login scaffolding only. No live SISIS authentication yet.',
    };
  }

  async fetchAccountSnapshot(): Promise<LibraryAccountSnapshotResult> {
    if (!this.isAccountLoginSupported()) {
      return {
        status: 'not_supported',
        message: 'Account snapshots are not supported for this provider yet.',
      };
    }

    return {
      status: 'success',
      snapshot: {
        loans: [],
        reservations: [],
      },
      message: 'Account snapshot scaffolding only. No live SISIS data yet.',
    };
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

  private resolveDetailUrl(input: { recordId: string; detailUrl?: string }): string | null {
    if (input.detailUrl) return input.detailUrl;
    if (input.recordId.startsWith('http://') || input.recordId.startsWith('https://')) {
      return input.recordId;
    }
    return null;
  }

  private parseDetailHtml(html: string, detailUrl: string, recordId: string): OpacRecord | null {
    const title = extractFirstMeta(html, META_TITLE_KEYS) ?? extractTitleTag(html);
    const authors = extractAllMeta(html, META_AUTHOR_KEYS);
    const description = extractFirstMeta(html, META_DESCRIPTION_KEYS);
    const publisher = extractFirstMeta(html, META_PUBLISHER_KEYS);
    const language = extractFirstMeta(html, META_LANGUAGE_KEYS);
    const publishedYear = extractYear(extractFirstMeta(html, META_DATE_KEYS));
    const coverCandidate = extractFirstMeta(html, META_COVER_KEYS);
    const coverUrl = coverCandidate ? resolveUrl(detailUrl, coverCandidate) : undefined;

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

  private buildSession(): LibraryAccountSession {
    return {
      id: `${this.system}-${this.provider.id}-${Date.now()}`,
      createdAt: new Date().toISOString(),
      opaqueToken: `scaffold-${Math.random().toString(36).slice(2, 10)}`,
    };
  }
}
