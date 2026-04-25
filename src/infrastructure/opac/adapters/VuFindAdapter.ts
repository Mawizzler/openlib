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
  OpacSearchFailureKind,
  OpacSearchResult,
} from '@/src/domain/models/opac';
import type { OpacappNormalizedProvider } from '@/src/domain/models/opacapp';
import { parseVuFindSearchResults } from '@/src/infrastructure/opac/parsers/vufind/parseVuFindSearchResults';

const DEFAULT_PAGE_SIZE = 20;
const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_HEADERS = {
  Accept: 'text/html,application/xhtml+xml',
  'User-Agent': 'openlib-vufind-adapter',
};
const BROWSER_PROFILE_HEADERS = {
  ...DEFAULT_HEADERS,
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'max-age=0',
  Pragma: 'no-cache',
  'Upgrade-Insecure-Requests': '1',
};
const NAVIGATE_METADATA_HEADERS = {
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'same-origin',
  'Sec-Fetch-User': '?1',
};
const META_TITLE_KEYS = ['citation_title', 'dc.title', 'dcterms.title', 'og:title', 'twitter:title'];
const META_AUTHOR_KEYS = ['citation_author', 'dc.creator', 'dcterms.creator', 'author'];
const META_DESCRIPTION_KEYS = ['description', 'dc.description', 'dcterms.description', 'og:description'];
const META_PUBLISHER_KEYS = ['citation_publisher', 'dc.publisher', 'dcterms.publisher'];
const META_LANGUAGE_KEYS = ['dc.language', 'dcterms.language', 'language'];
const META_DATE_KEYS = ['citation_publication_date', 'dc.date', 'dcterms.issued', 'dcterms.date'];
const META_COVER_KEYS = ['og:image', 'twitter:image', 'citation_cover_url'];
const WARMUP_PROVIDER_ID = '9051';

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

const buildFailure = (kind: OpacSearchFailureKind, error: unknown) => ({
  kind,
  message: error instanceof Error ? error.message : 'Unknown search error.',
});

type SessionState = {
  cookie?: string;
};

export class VuFindAdapter implements LibrarySystemAdapter {
  readonly system = 'vufind';
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
      const searchUrl = this.buildSearchUrl(baseUrl, input);
      const session: SessionState | undefined = this.isWarmupProvider() ? {} : undefined;
      if (session) {
        await this.performWarmup(baseUrl, session);
      }
      const searchHtml = await this.fetchHtml(searchUrl, session);
      const parsed = parseVuFindSearchResults(searchHtml, baseUrl);

      return {
        total: parsed.total ?? parsed.records.length,
        page,
        pageSize,
        records: parsed.records,
      };
    } catch (error) {
      console.warn('[VuFindAdapter] search failed', error);
      return {
        total: 0,
        page,
        pageSize,
        records: [],
        diagnostics: { failure: buildFailure('transport', error) },
      };
    }
  }

  async details(input: { recordId: string; detailUrl?: string }): Promise<OpacRecord | null> {
    const detailUrl = this.resolveDetailUrl(input);
    if (!detailUrl) {
      return null;
    }

    try {
      const html = await this.fetchHtml(detailUrl);
      return this.parseDetailHtml(html, detailUrl, input.recordId);
    } catch (error) {
      console.warn('[VuFindAdapter] details failed', error);
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
      message: 'Login scaffolding only. No live VuFind authentication yet.',
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
      message: 'Account snapshot scaffolding only. No live VuFind data yet.',
    };
  }

  private normalizeBaseUrl(baseUrl: string): string {
    return baseUrl.replace(/\/+$/, '');
  }

  private resolveDetailUrl(input: { recordId: string; detailUrl?: string }): string | null {
    if (input.detailUrl) return input.detailUrl;
    if (input.recordId.startsWith('http://') || input.recordId.startsWith('https://')) {
      return input.recordId;
    }
    if (!this.provider.baseUrl) return null;
    const baseUrl = this.normalizeBaseUrl(this.provider.baseUrl);
    try {
      return `${baseUrl}/Record/${encodeURIComponent(input.recordId)}`;
    } catch {
      return null;
    }
  }

  private parseDetailHtml(html: string, detailUrl: string, recordId: string): OpacRecord | null {
    const title = extractFirstMeta(html, META_TITLE_KEYS) ?? extractTitleTag(html);
    const authors = extractAllMeta(html, META_AUTHOR_KEYS);
    const description = extractFirstMeta(html, META_DESCRIPTION_KEYS);
    const publisher = extractFirstMeta(html, META_PUBLISHER_KEYS);
    const language = extractFirstMeta(html, META_LANGUAGE_KEYS);
    const publishedYear =
      extractYear(extractFirstMeta(html, META_DATE_KEYS)) ??
      extractYear(extractFirstMeta(html, META_DESCRIPTION_KEYS));
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

  private buildSearchUrl(baseUrl: string, input: LibrarySystemSearchInput): string {
    const url = new URL(`${baseUrl}/Search/Results`);
    const query = input.query.trim();
    const filters = input.filters ?? {};

    url.searchParams.set('lookfor', query);
    url.searchParams.set('type', this.pickTypeFilter(filters) ?? 'AllFields');

    const sort = this.pickFirstFilter(filters, ['sort']);
    url.searchParams.set('sort', sort ?? 'relevance');

    if (input.page && input.page > 1) {
      url.searchParams.set('page', String(input.page));
    }

    url.searchParams.set('limit', String(DEFAULT_PAGE_SIZE));

    this.appendFilters(url, filters);

    return url.toString();
  }

  private pickTypeFilter(filters: Record<string, string | string[]>): string | undefined {
    return this.pickFirstFilter(filters, ['type', 'field', 'searchType', 'search_field']);
  }

  private pickFirstFilter(
    filters: Record<string, string | string[]>,
    keys: string[],
  ): string | undefined {
    for (const key of keys) {
      const value = filters[key];
      if (Array.isArray(value)) {
        const entry = value.find((item) => item.trim());
        if (entry) return entry.trim();
      } else if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }
    return undefined;
  }

  private appendFilters(url: URL, filters: Record<string, string | string[]>) {
    const reserved = new Set(['type', 'field', 'searchType', 'search_field', 'sort']);
    Object.entries(filters).forEach(([key, value]) => {
      if (reserved.has(key)) return;
      const values = Array.isArray(value) ? value : [value];
      values
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => this.buildFilterToken(key, item))
        .filter(Boolean)
        .forEach((token) => url.searchParams.append('filter[]', token));
    });
  }

  private buildFilterToken(key: string, value: string): string {
    const needsQuotes = /\s/.test(value);
    const safeValue = needsQuotes ? `"${value}"` : value;
    return `${key}:${safeValue}`;
  }

  private isWarmupProvider(): boolean {
    return this.provider.id === WARMUP_PROVIDER_ID;
  }

  private async performWarmup(baseUrl: string, session: SessionState): Promise<void> {
    try {
      const warmupUrl = `${baseUrl}/`;
      await this.fetchHtmlResponse(warmupUrl, this.buildRequestHeaders(warmupUrl, false), session);
    } catch {
      // Warmup is best effort; continue search flow even if this preflight fails.
    }
  }

  private async fetchHtml(url: string, session?: SessionState): Promise<string> {
    const firstResponse = await this.fetchHtmlResponse(url, this.buildRequestHeaders(url, false), session);
    if (firstResponse.status === 419) {
      if (session && this.isWarmupProvider() && this.provider.baseUrl) {
        await this.performWarmup(this.normalizeBaseUrl(this.provider.baseUrl), session);
      }
      const retryResponse = await this.fetchHtmlResponse(url, this.buildRequestHeaders(url, true), session);
      if (!retryResponse.ok) {
        throw new Error(`VuFind request failed with HTTP ${retryResponse.status}`);
      }
      return await retryResponse.text();
    }

    if (!firstResponse.ok) {
      throw new Error(`VuFind request failed with HTTP ${firstResponse.status}`);
    }

    return await firstResponse.text();
  }

  private buildRequestHeaders(url: string, isRetry: boolean): Record<string, string> {
    if (!this.isWarmupProvider()) {
      return isRetry ? BROWSER_PROFILE_HEADERS : DEFAULT_HEADERS;
    }

    return this.buildWarmupProviderHeaders(url);
  }

  private buildWarmupProviderHeaders(url: string): Record<string, string> {
    const target = new URL(url);
    return {
      ...BROWSER_PROFILE_HEADERS,
      ...NAVIGATE_METADATA_HEADERS,
      Origin: target.origin,
      Referer: `${target.origin}/`,
    };
  }

  private async fetchHtmlResponse(
    url: string,
    headers: Record<string, string>,
    session?: SessionState,
  ): Promise<Response> {
    const controller = new AbortController();
    const handle = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          ...headers,
          ...(session?.cookie ? { Cookie: session.cookie } : {}),
        },
        redirect: 'follow',
        signal: controller.signal,
      });
      if (session) {
        this.captureCookies(response, session);
      }
      return response;
    } finally {
      clearTimeout(handle);
    }
  }

  private captureCookies(response: Response, session: SessionState) {
    try {
      const headerValues = [
        response.headers.get('set-cookie'),
        response.headers.get('x-openlib-proxy-set-cookie'),
      ].filter((value): value is string => Boolean(value));
      if (headerValues.length === 0) return;

      const incomingCookies = headerValues.flatMap((value) => this.extractCookiePairs(value));
      if (incomingCookies.length === 0) return;

      session.cookie = this.mergeCookies(session.cookie, incomingCookies);
    } catch {
      // Ignore cookie parsing errors and continue with transport fallback behavior.
    }
  }

  private extractCookiePairs(setCookieHeader: string): string[] {
    const pairs: string[] = [];
    const pattern = /(?:^|,)\s*([^=;,\s]+)=([^;,\r\n]*)/g;
    let match: RegExpExecArray | null = null;
    while ((match = pattern.exec(setCookieHeader)) !== null) {
      pairs.push(`${match[1]}=${match[2]}`);
    }
    return pairs;
  }

  private mergeCookies(currentCookieHeader: string | undefined, incomingPairs: string[]): string {
    const merged = new Map<string, string>();

    if (currentCookieHeader) {
      currentCookieHeader
        .split(';')
        .map((part) => part.trim())
        .filter(Boolean)
        .forEach((part) => {
          const separatorIndex = part.indexOf('=');
          if (separatorIndex <= 0) return;
          const key = part.slice(0, separatorIndex).trim();
          const value = part.slice(separatorIndex + 1).trim();
          if (key && value) {
            merged.set(key, value);
          }
        });
    }

    incomingPairs.forEach((pair) => {
      const separatorIndex = pair.indexOf('=');
      if (separatorIndex <= 0) return;
      const key = pair.slice(0, separatorIndex).trim();
      const value = pair.slice(separatorIndex + 1).trim();
      if (key && value) {
        merged.set(key, value);
      }
    });

    return Array.from(merged.entries())
      .map(([key, value]) => `${key}=${value}`)
      .join('; ');
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
